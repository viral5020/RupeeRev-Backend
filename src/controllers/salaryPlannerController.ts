import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import * as salaryPlannerService from '../services/salaryPlanner.service';

export const detectSalary = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const salary = await salaryPlannerService.detectSalary(userId);
  return sendSuccess(res, { salary });
};

export const generateSalaryPlan = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { monthlyIncome, essentialsPercent = 50, goalsPercent = 30, wantsPercent = 20 } = req.body;
  const plan = await salaryPlannerService.generateSalaryPlan(userId, monthlyIncome, essentialsPercent, goalsPercent, wantsPercent);
  return sendSuccess(res, plan);
};
