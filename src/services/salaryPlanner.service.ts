import Transaction from '../models/transaction';
import dayjs from 'dayjs';
import logger from '../utils/logger';

export interface SalaryPlan {
  essentials: number;
  financialGoals: number;
  wants: number;
  total: number;
  breakdown: {
    category: string;
    amount: number;
    percentage: number;
    type: 'essential' | 'goal' | 'want';
  }[];
}

const ESSENTIAL_CATEGORIES = ['Food', 'Groceries', 'Rent', 'Utilities', 'Transport', 'Healthcare', 'Bills'];
const GOAL_CATEGORIES = ['Investment', 'SIP', 'Savings', 'EMI', 'Insurance'];

export const detectSalary = async (userId: string): Promise<number | null> => {
  logger.info('Auto-detecting salary from income patterns…');
  const now = dayjs();
  const last6Months = [];

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
    if (total > 0) last6Months.push(total);
  }

  if (last6Months.length === 0) return null;

  // Find most common salary amount (within 5% tolerance)
  const sorted = [...last6Months].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Check if amounts are consistent (within 5%)
  const consistent = last6Months.filter((amt) => Math.abs(amt - median) / median < 0.05);
  if (consistent.length >= 3) {
    const avg = consistent.reduce((sum, a) => sum + a, 0) / consistent.length;
    logger.info(`Detected salary: ₹${Math.round(avg).toLocaleString('en-IN')}/month`);
    return Math.round(avg);
  }

  return null;
};

export const generateSalaryPlan = async (
  userId: string,
  monthlyIncome: number,
  essentialsPercent = 50,
  goalsPercent = 30,
  wantsPercent = 20
): Promise<SalaryPlan> => {
  logger.info(`Generating salary plan: ${essentialsPercent}/${goalsPercent}/${wantsPercent} split`);
  const now = dayjs();
  const last3Months = [];

  for (let i = 1; i <= 3; i++) {
    const month = now.subtract(i, 'month').month() + 1;
    const year = now.subtract(i, 'month').year();
    const start = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const end = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const txns = await Transaction.find({
      user: userId,
      type: 'expense',
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 });

    last3Months.push(txns);
  }

  const categoryTotals: Record<string, number> = {};
  last3Months.flat().forEach((t) => {
    const catName = (t.category || 'Other').trim();
    categoryTotals[catName] = (categoryTotals[catName] || 0) + t.amount;
  });

  const avgByCategory: Record<string, number> = {};
  Object.keys(categoryTotals).forEach((cat) => {
    avgByCategory[cat] = categoryTotals[cat] / 3;
  });

  const essentials = (monthlyIncome * essentialsPercent) / 100;
  const financialGoals = (monthlyIncome * goalsPercent) / 100;
  const wants = (monthlyIncome * wantsPercent) / 100;

  const breakdown: SalaryPlan['breakdown'] = [];

  Object.entries(avgByCategory).forEach(([category, avgAmount]) => {
    const isEssential = ESSENTIAL_CATEGORIES.some((ec) => category.toLowerCase().includes(ec.toLowerCase()));
    const isGoal = GOAL_CATEGORIES.some((gc) => category.toLowerCase().includes(gc.toLowerCase()));

    let type: 'essential' | 'goal' | 'want' = 'want';
    if (isEssential) type = 'essential';
    else if (isGoal) type = 'goal';

    breakdown.push({
      category,
      amount: Math.round(avgAmount),
      percentage: Math.round((avgAmount / monthlyIncome) * 100),
      type,
    });
  });

  breakdown.sort((a, b) => b.amount - a.amount);

  return {
    essentials: Math.round(essentials),
    financialGoals: Math.round(financialGoals),
    wants: Math.round(wants),
    total: monthlyIncome,
    breakdown,
  };
};

