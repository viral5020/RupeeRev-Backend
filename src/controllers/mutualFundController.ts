import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { getLatestCategoryPerformance } from '../services/categoryPerformanceService';
import { generateRecommendation } from '../services/investmentAI';
import logger from '../utils/logger';

export const listCategoryPerformance = async (_req: Request, res: Response) => {
  const data = await getLatestCategoryPerformance();
  const formatted = data.map((item) => ({
    id: (item as any)._id?.toString?.() ?? item.normalizedCategory,
    category: item.category,
    normalizedCategory: item.normalizedCategory,
    avg1Month: item.avg1Month,
    avg3Month: item.avg3Month,
    avg1Year: item.avg1Year,
    updatedAt: item.updatedAt,
  }));
  return sendSuccess(res, formatted);
};

export const recommendInvestment = async (req: Request, res: Response) => {
  const { surplus, riskLevel } = req.body;
  try {
    const recommendation = await generateRecommendation(Number(surplus), riskLevel);
    return sendSuccess(res, recommendation);
  } catch (error) {
    logger.error('AI recommendation failed', { error });
    const message = error instanceof Error ? error.message : 'Unable to generate recommendation';
    return sendError(res, message, 400);
  }
};


