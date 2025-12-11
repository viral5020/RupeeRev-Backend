import Goal, { GoalPriority } from './goal.model';
import logger from '../../utils/logger';
import { calculateSipDuration } from '../../utils/sipCalculator';
import { getLatestCategoryPerformance } from '../../services/categoryPerformanceService';

const PRIORITY_WEIGHTS: Record<GoalPriority, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
};

const RISK_CATEGORY_MAP: Record<'low' | 'medium' | 'high', string[]> = {
  low: ['debt', 'gold', 'index'],
  medium: ['balanced', 'index', 'gold'],
  high: ['equity', 'balanced', 'index'],
};

const EXPECTED_RETURNS: Record<string, number> = {
  equity: 15,
  index: 15,
  balanced: 9,
  gold: 7,
  debt: 6,
};

const selectCategoryForGoal = (
  riskLevel: 'low' | 'medium' | 'high',
  priority: GoalPriority,
  performance: Awaited<ReturnType<typeof getLatestCategoryPerformance>>
) => {
  const preferred = RISK_CATEGORY_MAP[riskLevel];
  const candidates = performance.filter((item) => preferred.includes(item.normalizedCategory));
  if (candidates.length) {
    return candidates.reduce((best, item) => (item.avg1Year > best.avg1Year ? item : best));
  }
  return performance.reduce((best, item) => (item.avg1Year > best.avg1Year ? item : best));
};

type GoalPayload = {
  name: string;
  targetAmount: number;
  priority: GoalPriority;
};

type GoalUpdatePayload = Partial<GoalPayload> & { status?: 'in-progress' | 'achievable' | 'completed' };

export const createGoal = async (userId: string, payload: GoalPayload) => {
  logger.info(`Creating goal: ${payload.name}, Priority: ${payload.priority}`);
  return Goal.create({ ...payload, userId });
};

export const getGoals = (userId: string) => Goal.find({ userId }).sort({ createdAt: -1 });

export const updateGoal = async (userId: string, goalId: string, payload: GoalUpdatePayload) => {
  logger.info(`Updating goal ${goalId}`);
  const goal = await Goal.findOneAndUpdate({ _id: goalId, userId }, payload, { new: true });
  if (!goal) throw new Error('Goal not found');
  logger.info('Updated Goal → monthlyContribution recalculated soon.');
  return goal;
};

export const deleteGoal = async (userId: string, goalId: string) => {
  const goal = await Goal.findOneAndDelete({ _id: goalId, userId });
  if (!goal) throw new Error('Goal not found');
  logger.info(`Deleted goal ${goalId}`);
  return goal;
};

const sortByPriority = (priority: GoalPriority) => {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
};

export const allocateSurplusToGoals = async (
  userId: string,
  surplus: number,
  riskLevel: 'low' | 'medium' | 'high'
) => {
  logger.info('Allocating surplus to goals based on priority…', { surplus, riskLevel });
  const goals = await Goal.find({ userId, status: { $ne: 'completed' } });
  goals.sort((a, b) => sortByPriority(a.priority) - sortByPriority(b.priority));
  if (!goals.length || surplus <= 0) {
    logger.info('No goals or surplus available for allocation.');
    return goals;
  }

  const performance = await getLatestCategoryPerformance();

  // Calculate weights for each goal: priorityWeight * returnWeight * urgencyFactor
  const goalWeights: Array<{ goal: any; weight: number; returnWeight: number; urgencyFactor: number }> = [];

  for (const goal of goals) {
    const categoryData = selectCategoryForGoal(riskLevel, goal.priority, performance);
    const categoryKey = categoryData?.normalizedCategory || 'index';
    const annualReturn = EXPECTED_RETURNS[categoryKey] ?? categoryData?.avg1Year ?? 8;

    // Return weight: Higher return = higher weight (normalized 0.5-1.5)
    const returnWeight = Math.min(1.5, Math.max(0.5, annualReturn / 12));

    // Urgency factor: Shorter timeline = higher urgency (inverse of months, normalized)
    const monthsLeft = goal.expectedMonths || 60;
    const urgencyFactor = Math.min(1.5, Math.max(0.5, 60 / Math.max(monthsLeft, 1)));

    // Priority weight
    const priorityWeight = PRIORITY_WEIGHTS[goal.priority] || 0.4;

    // Combined weight
    const totalWeight = priorityWeight * returnWeight * urgencyFactor;

    goalWeights.push({ goal, weight: totalWeight, returnWeight, urgencyFactor });
  }

  // Normalize weights
  const sumWeights = goalWeights.reduce((sum, gw) => sum + gw.weight, 0) || 1;

  // First pass: Calculate raw allocations
  let totalAllocated = 0;
  const rawAllocations: { goal: any; amount: number }[] = [];

  for (const { goal, weight } of goalWeights) {
    const share = weight / sumWeights;
    let monthlyContribution = Math.max(0, Math.round(surplus * share));

    // Cap allocation to avoid over-funding short term goals
    const categoryData = selectCategoryForGoal(riskLevel, goal.priority, performance);
    const categoryKey = categoryData?.normalizedCategory || 'index';
    const annualReturn = EXPECTED_RETURNS[categoryKey] ?? categoryData?.avg1Year ?? 8;
    const tempDuration = calculateSipDuration(goal.targetAmount, monthlyContribution, annualReturn);
    
    // Don't allocate more than needed for goal
    const maxRequiredSIP = Math.ceil(goal.targetAmount / Math.max(tempDuration.expectedMonths, 12));
    if (monthlyContribution > maxRequiredSIP) {
      monthlyContribution = maxRequiredSIP;
    }

    rawAllocations.push({ goal, amount: monthlyContribution });
    totalAllocated += monthlyContribution;
  }

  // Second pass: Apply hard cap if total exceeds surplus (MUST NOT exceed)
  if (totalAllocated > surplus) {
    const scaleFactor = surplus / totalAllocated;
    logger.info(`Total allocated ${totalAllocated} > Surplus ${surplus}. Scaling by ${scaleFactor.toFixed(3)}`);
    
    // Redistribute: High priority gets more, low gets minimum
    const highPriorityAllocations = rawAllocations.filter((a) => a.goal.priority === 'high');
    const mediumPriorityAllocations = rawAllocations.filter((a) => a.goal.priority === 'medium');
    const lowPriorityAllocations = rawAllocations.filter((a) => a.goal.priority === 'low');

    let remainingSurplus = surplus;
    const finalAllocations: { goal: any; amount: number }[] = [];

    // High priority: Get proportional share first
    const highTotal = highPriorityAllocations.reduce((sum, a) => sum + a.amount, 0);
    if (highTotal > 0) {
      const highShare = Math.min(remainingSurplus * 0.5, highTotal * scaleFactor);
      const highScale = highShare / highTotal;
      highPriorityAllocations.forEach((a) => {
        const amount = Math.floor(a.amount * highScale);
        finalAllocations.push({ goal: a.goal, amount });
        remainingSurplus -= amount;
      });
    }

    // Medium priority: Get proportional share
    const mediumTotal = mediumPriorityAllocations.reduce((sum, a) => sum + a.amount, 0);
    if (mediumTotal > 0 && remainingSurplus > 0) {
      const mediumShare = Math.min(remainingSurplus * 0.7, mediumTotal * scaleFactor);
      const mediumScale = mediumShare / mediumTotal;
      mediumPriorityAllocations.forEach((a) => {
        const amount = Math.floor(a.amount * mediumScale);
        finalAllocations.push({ goal: a.goal, amount });
        remainingSurplus -= amount;
      });
    }

    // Low priority: Get minimum recommended (₹500) or remaining
    lowPriorityAllocations.forEach((a) => {
      const amount = Math.min(500, remainingSurplus, Math.floor(a.amount * scaleFactor));
      if (amount > 0) {
        finalAllocations.push({ goal: a.goal, amount });
        remainingSurplus -= amount;
      }
    });

    // Update goals with final allocations
    for (const allocation of finalAllocations) {
      const { goal, amount } = allocation;
      const categoryData = selectCategoryForGoal(riskLevel, goal.priority, performance);
      const categoryKey = categoryData?.normalizedCategory || 'index';
      const annualReturn = EXPECTED_RETURNS[categoryKey] ?? categoryData?.avg1Year ?? 8;

      logger.info(`${goal.name} Goal (${goal.priority.toUpperCase()}): Assigned ₹${amount}/month`);
      const sipDuration = calculateSipDuration(goal.targetAmount, amount, annualReturn);

      goal.monthlyContribution = amount;
      goal.expectedMonths = sipDuration.expectedMonths;
      goal.expectedYears = sipDuration.expectedYears;
      goal.minimumTenureApplied = sipDuration.minimumTenureApplied;
      goal.note = sipDuration.note;
      goal.categorySuggested = categoryData?.normalizedCategory || goal.categorySuggested;
      goal.status = amount > 0 ? 'achievable' : goal.status;
      await goal.save();
    }
  } else {
    // No scaling needed, use raw allocations
    for (const allocation of rawAllocations) {
      const { goal, amount } = allocation;
      const categoryData = selectCategoryForGoal(riskLevel, goal.priority, performance);
      const categoryKey = categoryData?.normalizedCategory || 'index';
      const annualReturn = EXPECTED_RETURNS[categoryKey] ?? categoryData?.avg1Year ?? 8;

      logger.info(`${goal.name} Goal (${goal.priority.toUpperCase()}): Assigned ₹${amount}/month`);
      const sipDuration = calculateSipDuration(goal.targetAmount, amount, annualReturn);

      goal.monthlyContribution = amount;
      goal.expectedMonths = sipDuration.expectedMonths;
      goal.expectedYears = sipDuration.expectedYears;
      goal.minimumTenureApplied = sipDuration.minimumTenureApplied;
      goal.note = sipDuration.note;
      goal.categorySuggested = categoryData?.normalizedCategory || goal.categorySuggested;
      goal.status = amount > 0 ? 'achievable' : goal.status;
      await goal.save();
    }
  }

  logger.info(`Allocation complete. Total allocated: ₹${Math.min(totalAllocated, surplus)} of ₹${surplus} surplus.`);
  return goals;
};


