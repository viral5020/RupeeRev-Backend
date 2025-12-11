import { Request, Response } from 'express';
import { getBudget, upsertBudget } from '../services/budgetService';
import { sendSuccess } from '../utils/apiResponse';

export const get = async (req: Request, res: Response) => {
  const { month, year } = req.query;
  const budget = await getBudget(req.user!, Number(month), Number(year));
  return sendSuccess(res, budget);
};

export const upsert = async (req: Request, res: Response) => {
  const budget = await upsertBudget(req.user!, req.body);
  return sendSuccess(res, budget, 'Budget saved');
};

