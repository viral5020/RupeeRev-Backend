import { Request, Response } from 'express';
import { getCategoryStats, getMonthlyStats } from '../services/statsService';
import { sendSuccess } from '../utils/apiResponse';

export const monthly = async (req: Request, res: Response) => {
  const stats = await getMonthlyStats(req.user!, Number(req.query.month), Number(req.query.year));
  return sendSuccess(res, stats);
};

export const category = async (req: Request, res: Response) => {
  const stats = await getCategoryStats(req.user!, req.query.startDate as string, req.query.endDate as string);
  return sendSuccess(res, stats);
};

