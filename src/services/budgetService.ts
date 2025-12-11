import Budget from '../models/budget';
import { IUserDocument } from '../models/user';

export interface BudgetPayload {
  month: number;
  year: number;
  totalLimit: number;
  categoryBudgets: { category: string; limit: number }[];
}

export const upsertBudget = async (user: IUserDocument, payload: BudgetPayload) => {
  const budget = await Budget.findOneAndUpdate(
    { user: user.id, month: payload.month, year: payload.year },
    {
      totalLimit: payload.totalLimit,
      categoryBudgets: payload.categoryBudgets.map((cb) => ({
        category: cb.category,
        limit: cb.limit,
      })),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return budget;
};

export const getBudget = (user: IUserDocument, month: number, year: number) =>
  Budget.findOne({ user: user.id, month, year }).populate('categoryBudgets.category');

