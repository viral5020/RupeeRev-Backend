import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import * as goalService from './goal.service';
import * as investmentService from '../../services/investmentService';

const triggerAutoAllocation = async (userId: string) => {
  const surplusData = await investmentService.calculateSurplus(userId);
  const profile = await investmentService.getFinancialProfile(userId);
  const allocationSurplus = profile?.manualSurplus ?? surplusData.surplus;
  await goalService.allocateSurplusToGoals(userId, allocationSurplus, profile?.riskLevel || 'medium');
};

export const createGoal = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const goal = await goalService.createGoal(userId, req.body);
  await triggerAutoAllocation(userId);
  return sendSuccess(res, goal, 'Goal created');
};

export const listGoals = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const goals = await goalService.getGoals(userId);
  return sendSuccess(res, goals);
};

export const updateGoal = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const goal = await goalService.updateGoal(userId, id, req.body);
  await triggerAutoAllocation(userId);
  return sendSuccess(res, goal, 'Goal updated');
};

export const deleteGoal = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  await goalService.deleteGoal(userId, id);
  await triggerAutoAllocation(userId);
  return sendSuccess(res, true, 'Goal deleted');
};



