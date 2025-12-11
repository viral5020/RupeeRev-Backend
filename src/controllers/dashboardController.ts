import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import * as investmentService from '../services/investmentService';
import Transaction from '../models/transaction';
import dayjs from 'dayjs';
import Account from '../models/account';

export const getDashboardData = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const now = dayjs();

  // Net Worth
  const accounts = await Account.find({ user: userId });
  const currentNetWorth = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  const lastMonth = now.subtract(1, 'month');
  const lastMonthStart = lastMonth.startOf('month').toDate();
  const lastMonthEnd = lastMonth.endOf('month').toDate();
  const lastMonthTxns = await Transaction.find({
    user: userId,
    date: { $gte: lastMonthStart, $lte: lastMonthEnd },
  });
  const lastMonthNetWorth = currentNetWorth - lastMonthTxns.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) + lastMonthTxns.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  // Emergency Fund
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
    });
    const total = txns.reduce((sum, t) => sum + t.amount, 0);
    last3Months.push(total);
  }
  const avgMonthlyExpense = last3Months.reduce((sum, v) => sum + v, 0) / last3Months.length || 0;

  // Surplus Allocation
  const surplus = await investmentService.calculateSurplus(userId);
  const currentMonth = now.month() + 1;
  const currentYear = now.year();
  const startDate = dayjs(`${currentYear}-${currentMonth}-01`).startOf('month').toDate();
  const endDate = dayjs(`${currentYear}-${currentMonth}-01`).endOf('month').toDate();

  const bills = await Transaction.find({
    user: userId,
    type: 'expense',
    date: { $gte: startDate, $lte: endDate },
    isRecurring: true,
  });
  const billsTotal = bills.reduce((sum, t) => sum + t.amount, 0);

  // Estimate essentials (food, groceries, transport)
  const essentials = await Transaction.find({
    user: userId,
    type: 'expense',
    date: { $gte: startDate, $lte: endDate },
  }).populate('category');
  const essentialsTotal = essentials
    .filter((t) => {
      const catName = ((t.category as any)?.name || '').toLowerCase();
      return catName.includes('food') || catName.includes('grocery') || catName.includes('transport');
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Get active SIPs (goals with monthly contribution)
  const Goal = (await import('../modules/goals/goal.model')).default;
  const goals = await Goal.find({ userId });
  const sipsTotal = goals.reduce((sum, g) => sum + (g.monthlyContribution || 0), 0);

  // Spending Twins (Average of last 3 months)
  const last3MonthsSurplus = [];
  for (let i = 1; i <= 3; i++) {
    const month = now.subtract(i, 'month').month() + 1;
    const year = now.subtract(i, 'month').year();
    const s = await investmentService.calculateSurplus(userId, month, year);
    last3MonthsSurplus.push(s);
  }
  const avgSurplus = last3MonthsSurplus.reduce((sum, s) => sum + s.surplus, 0) / 3;

  return sendSuccess(res, {
    netWorth: {
      current: currentNetWorth,
      lastMonth: lastMonthNetWorth,
    },
    emergencyFund: {
      current: currentNetWorth * 0.1, // Assume 10% of net worth is emergency fund
      avgMonthlyExpense,
      recommendedMonths: 6,
    },
    surplusAllocation: {
      essentials: essentialsTotal,
      bills: billsTotal,
      sips: sipsTotal,
      surplus: surplus.surplus,
      total: surplus.income,
    },
    spendingTwins: {
      avgSurplus,
      avgExpense: avgMonthlyExpense
    }
  });
};

