import Transaction from '../models/transaction';
import Goal from '../modules/goals/goal.model';
import dayjs from 'dayjs';
import logger from '../utils/logger';
import * as predictionService from './prediction.service';
import * as salaryPlannerService from './salaryPlanner.service';
import * as goalEnhancerService from './goalEnhancer.service';
import * as investmentService from './investmentService';
import * as goalService from '../modules/goals/goal.service';

export interface AnalysisResult {
  summary: {
    totalImported: number;
    dateRange: { start: Date; end: Date };
    totalIncome: number;
    totalExpenses: number;
    avgMonthlyIncome: number;
    avgMonthlyExpense: number;
  };
  categories: Array<{ name: string; total: number; count: number }>;
  subscriptions: Array<{ merchant: string; amount: number; frequency: string }>;
  salaryDetected: number | null;
  monthlyAverages: Array<{ month: string; income: number; expense: number; surplus: number }>;
  spendingSpikes: Array<{ month: string; amount: number; category: string }>;
  updatedSurplus: number;
  updatedSavingsRate: number;
  goalImpact: Array<{ goalId: string; goalName: string; newSip: number; oldSip: number }>;
}

export const analyzeBankStatementImport = async (userId: string, importBatchId: string): Promise<AnalysisResult> => {
  logger.info('Starting bank statement analysis after PDF import…');

  // Get transactions for this import batch
  const allTransactions = await Transaction.find({ user: userId, importBatchId })
    .populate('category')
    .sort({ date: 1 });


  if (allTransactions.length === 0) {
    throw new Error('No transactions found for this import batch');
  }

  const dateRange = {
    start: allTransactions[0].date,
    end: allTransactions[allTransactions.length - 1].date,
  };

  const income = allTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = allTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  // Monthly averages
  const monthlyData: Record<string, { income: number; expense: number; count: number }> = {};
  allTransactions.forEach((t) => {
    const monthKey = dayjs(t.date).format('YYYY-MM');
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expense: 0, count: 0 };
    }
    if (t.type === 'income') monthlyData[monthKey].income += t.amount;
    else monthlyData[monthKey].expense += t.amount;
    monthlyData[monthKey].count++;
  });

  const monthlyAverages = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    income: data.income,
    expense: data.expense,
    surplus: data.income - data.expense,
  }));

  const totalMonths = Object.keys(monthlyData).length;
  const avgMonthlyIncome = income / totalMonths;
  const avgMonthlyExpense = expenses / totalMonths;

  // Category breakdown
  const categoryMap: Record<string, { total: number; count: number }> = {};
  allTransactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const catName = ((t.category as any)?.name || 'Other').trim();
      if (!categoryMap[catName]) {
        categoryMap[catName] = { total: 0, count: 0 };
      }
      categoryMap[catName].total += t.amount;
      categoryMap[catName].count++;
    });

  const categories = Object.entries(categoryMap)
    .map(([name, data]) => ({ name, total: data.total, count: data.count }))
    .sort((a, b) => b.total - a.total);

  // Detect subscriptions
  const subscriptions = await predictionService.predictSubscriptions(userId);

  // Detect salary
  const salaryDetected = await salaryPlannerService.detectSalary(userId);

  // Spending spikes
  const spendingSpikes: Array<{ month: string; amount: number; category: string }> = [];
  Object.entries(monthlyData).forEach(([month, data]) => {
    if (data.expense > avgMonthlyExpense * 1.3) {
      // Find top category for this month
      const monthStart = dayjs(month).startOf('month').toDate();
      const monthEnd = dayjs(month).endOf('month').toDate();
      const monthTxns = allTransactions.filter(
        (t) => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd
      );
      const catTotals: Record<string, number> = {};
      monthTxns.forEach((t) => {
        const catName = ((t.category as any)?.name || 'Other').trim();
        catTotals[catName] = (catTotals[catName] || 0) + t.amount;
      });
      const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
      if (topCat) {
        spendingSpikes.push({ month, amount: data.expense, category: topCat[0] });
      }
    }
  });

  // Recalculate surplus
  const surplusData = await investmentService.calculateSurplus(userId);
  const profile = await investmentService.getFinancialProfile(userId);
  const riskLevel = profile?.riskLevel || 'medium';

  // Update goals
  const goals = await Goal.find({ userId });
  const goalImpact: Array<{ goalId: string; goalName: string; newSip: number; oldSip: number }> = [];

  for (const goal of goals) {
    const oldSip = goal.monthlyContribution || 0;
    await goalService.allocateSurplusToGoals(userId, surplusData.surplus, riskLevel);
    // Reload goal to get updated SIP
    const updatedGoal = await Goal.findById(goal._id);
    const newSip = updatedGoal?.monthlyContribution || 0;
    if (oldSip !== newSip) {
      goalImpact.push({
        goalId: goal._id.toString(),
        goalName: goal.name,
        newSip,
        oldSip,
      });
    }
  }

  logger.info('Bank statement analysis complete');

  return {
    summary: {
      totalImported: allTransactions.filter((t) => t.tags?.includes('fromPDF')).length,
      dateRange,
      totalIncome: income,
      totalExpenses: expenses,
      avgMonthlyIncome,
      avgMonthlyExpense,
    },
    categories,
    subscriptions: subscriptions.map((s) => ({
      merchant: s.merchant,
      amount: s.amount,
      frequency: s.frequency,
    })),
    salaryDetected,
    monthlyAverages,
    spendingSpikes,
    updatedSurplus: surplusData.surplus,
    updatedSavingsRate: surplusData.savingsRate,
    goalImpact,
  };
};


