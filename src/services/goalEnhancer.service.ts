import Goal from '../modules/goals/goal.model';
import { calculateSipDuration } from '../utils/sipCalculator';
import { getLatestCategoryPerformance } from '../services/categoryPerformanceService';
import Transaction from '../models/transaction';
import dayjs from 'dayjs';
import logger from '../utils/logger';

export interface GoalConfidenceScore {
  score: number;
  factors: {
    sipAdequacy: number;
    tenureLeft: number;
    categoryReturn: number;
    surplusAvailability: number;
  };
  breakdown: string[];
}

const EXPECTED_RETURNS: Record<string, number> = {
  equity: 15,
  index: 12,
  balanced: 9,
  gold: 7,
  debt: 6,
};

export const calculateGoalConfidence = async (
  userId: string,
  goal: any,
  currentSurplus: number
): Promise<GoalConfidenceScore> => {
  logger.info(`Calculating confidence score for goal: ${goal.name}`);
  const performance = await getLatestCategoryPerformance();
  const categoryData = performance.find((p) => p.normalizedCategory === goal.categorySuggested);
  const annualReturn = categoryData?.avg1Year ?? EXPECTED_RETURNS[goal.categorySuggested] ?? 8;

  // Factor 1: SIP Adequacy (0-30 points)
  const requiredSIP = goal.monthlyContribution || 0;
  const optimalSIP = calculateSipDuration(goal.targetAmount, 0, annualReturn);
  const optimalMonthly = goal.targetAmount / (optimalSIP.expectedMonths || 12);
  const sipAdequacy = requiredSIP > 0 ? Math.min(30, (requiredSIP / optimalMonthly) * 30) : 0;

  // Factor 2: Tenure Left (0-25 points)
  const monthsLeft = goal.expectedMonths || 0;
  const tenureScore = monthsLeft <= 12 ? 25 : monthsLeft <= 24 ? 20 : monthsLeft <= 36 ? 15 : 10;

  // Factor 3: Category Return (0-25 points)
  const returnScore = annualReturn >= 12 ? 25 : annualReturn >= 9 ? 20 : annualReturn >= 7 ? 15 : 10;

  // Factor 4: Surplus Availability (0-20 points)
  const surplusRatio = currentSurplus > 0 ? Math.min(1, requiredSIP / currentSurplus) : 0;
  const surplusScore = surplusRatio >= 1 ? 20 : surplusRatio >= 0.8 ? 15 : surplusRatio >= 0.5 ? 10 : 5;

  const totalScore = Math.round(sipAdequacy + tenureScore + returnScore + surplusScore);
  const factors = {
    sipAdequacy: Math.round(sipAdequacy),
    tenureLeft: tenureScore,
    categoryReturn: returnScore,
    surplusAvailability: surplusScore,
  };

  const breakdown: string[] = [];
  if (sipAdequacy < 20) breakdown.push('SIP amount may be insufficient');
  if (tenureScore < 15) breakdown.push('Timeline is tight');
  if (returnScore < 15) breakdown.push('Category returns are moderate');
  if (surplusScore < 10) breakdown.push('Limited surplus available');

  return { score: totalScore, factors, breakdown };
};

export const detectSalaryIncrease = async (userId: string): Promise<{ increase: number; suggestedSipRaise: number } | null> => {
  logger.info('Detecting salary increase from income patterns…');
  const now = dayjs();
  const last6Months: number[] = [];

  for (let i = 0; i < 6; i++) {
    const month = now.subtract(i, 'month').month() + 1;
    const year = now.subtract(i, 'month').year();
    const start = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const end = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const txns = await Transaction.find({
      user: userId,
      type: 'income',
      date: { $gte: start, $lte: end },
    });

    const total = txns.reduce((sum, t) => sum + t.amount, 0);
    last6Months.push(total);
  }

  if (last6Months.length < 3) return null;

  const recent3 = last6Months.slice(0, 3).reduce((sum, a) => sum + a, 0) / 3;
  const older3 = last6Months.slice(3, 6).reduce((sum, a) => sum + a, 0) / 3;

  if (older3 === 0) return null;

  const increasePercent = ((recent3 - older3) / older3) * 100;
  if (increasePercent < 5) return null; // Less than 5% increase, ignore

  const increase = recent3 - older3;
  const suggestedSipRaise = Math.round(increase * 0.3); // Suggest 30% of increase to SIP

  logger.info(`Detected salary increase: ₹${Math.round(increase).toLocaleString('en-IN')} (${Math.round(increasePercent)}%)`);
  return { increase: Math.round(increase), suggestedSipRaise };
};

export const fixSipTimeline = (goal: any): { expectedMonths: number; expectedYears: number; minimumTenureApplied: boolean } => {
  if (goal.expectedMonths < 12) {
    logger.info(`Fixing SIP timeline for goal ${goal.name}: enforcing minimum 12 months`);
    return {
      expectedMonths: 12,
      expectedYears: 1,
      minimumTenureApplied: true,
    };
  }
  return {
    expectedMonths: goal.expectedMonths,
    expectedYears: goal.expectedYears,
    minimumTenureApplied: goal.minimumTenureApplied || false,
  };
};

