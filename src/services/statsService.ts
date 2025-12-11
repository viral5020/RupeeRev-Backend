import dayjs from 'dayjs';
import Transaction from '../models/transaction';
import { IUserDocument } from '../models/user';

export const getMonthlyStats = async (user: IUserDocument, month?: number, year?: number) => {
  const targetMonth = month ?? dayjs().month() + 1;
  const targetYear = year ?? dayjs().year();
  const start = dayjs().year(targetYear).month(targetMonth - 1).startOf('month').toDate();
  const end = dayjs(start).endOf('month').toDate();
  const stats = await Transaction.aggregate([
    {
      $match: {
        user: user._id,
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
      },
    },
  ]);
  const income = stats.find((s) => s._id === 'income')?.total || 0;
  const expense = stats.find((s) => s._id === 'expense')?.total || 0;
  return {
    month: targetMonth,
    year: targetYear,
    totalIncome: income,
    totalExpense: expense,
    savings: income - expense,
  };
};

type MatchFilter = {
  user: IUserDocument['_id'];
  date?: {
    $gte?: Date;
    $lte?: Date;
  };
};

export const getCategoryStats = (user: IUserDocument, startDate?: string, endDate?: string) => {
  const $match: MatchFilter = { user: user._id };
  if (startDate || endDate) {
    $match.date = {};
    if (startDate) $match.date.$gte = new Date(startDate);
    if (endDate) $match.date.$lte = new Date(endDate);
  }
  return Transaction.aggregate([
    { $match },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
      },
    },
    {
      $project: {
        categoryId: '$_id',
        name: '$_id',
        color: { $literal: '#cccccc' }, // Default color, or maybe we can improve this later
        icon: { $literal: 'Category' }, // Default icon
        total: 1,
      },
    },
    { $sort: { total: -1 } },
  ]);
};

