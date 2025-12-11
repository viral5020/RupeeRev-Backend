import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import * as predictionService from '../services/prediction.service';

export const getCategorySpike = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const spike = await predictionService.detectCategorySpike(userId);
  return sendSuccess(res, spike);
};

export const getOverspendingWarning = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const warning = await predictionService.predictOverspending(userId);
  return sendSuccess(res, warning);
};

export const getSubscriptionPredictions = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const predictions = await predictionService.predictSubscriptions(userId);
  return sendSuccess(res, predictions);
};

export const getRepeatedMerchants = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const merchants = await predictionService.detectRepeatedMerchants(userId);
  return sendSuccess(res, merchants);
};

export const getAIPrediction = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const prediction = await predictionService.predictMonthlyExpenseAI(userId);
  return sendSuccess(res, prediction);
};

export const getPredictedBills = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const bills = await predictionService.predictBills(userId);
  return sendSuccess(res, bills);
};

export const getAIInsights = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const insights = await predictionService.generateAIInsights(userId);
  return sendSuccess(res, insights);
};

