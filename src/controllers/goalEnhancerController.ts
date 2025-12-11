import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import * as goalEnhancerService from '../services/goalEnhancer.service';
import * as investmentService from '../services/investmentService';
import Goal from '../modules/goals/goal.model';

export const getGoalConfidence = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { goalId } = req.params;
  const goal = await Goal.findOne({ _id: goalId, userId });
  if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

  const surplus = await investmentService.calculateSurplus(userId);
  const confidence = await goalEnhancerService.calculateGoalConfidence(userId, goal, surplus.surplus);
  return sendSuccess(res, confidence);
};

export const detectSalaryIncrease = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const result = await goalEnhancerService.detectSalaryIncrease(userId);
  return sendSuccess(res, result);
};

export const fixSipTimeline = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { goalId } = req.params;
  const goal = await Goal.findOne({ _id: goalId, userId });
  if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

  const fixed = goalEnhancerService.fixSipTimeline(goal);
  goal.expectedMonths = fixed.expectedMonths;
  goal.expectedYears = fixed.expectedYears;
  goal.minimumTenureApplied = fixed.minimumTenureApplied;
  await goal.save();

  return sendSuccess(res, fixed);
};

