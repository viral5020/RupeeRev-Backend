import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/apiResponse';
import * as aiInsightsService from '../services/aiInsights.service';
import logger from '../utils/logger';

/**
 * Get AI insights for the authenticated user
 */
export const getAiInsights = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        logger.info(`Fetching AI insights for user ${userId}`);

        const insights = await aiInsightsService.getLatestInsights(userId);
        return sendSuccess(res, insights);
    } catch (error: any) {
        logger.error('Failed to get AI insights', error);
        return sendError(res, error.message || 'Failed to fetch AI insights', 500);
    }
};

/**
 * Refresh AI insights (force regeneration)
 */
export const refreshAiInsights = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        logger.info(`Refreshing AI insights for user ${userId}`);

        const insights = await aiInsightsService.generateAiInsights(userId, true);
        return sendSuccess(res, insights);
    } catch (error: any) {
        logger.error('Failed to refresh AI insights', error);
        return sendError(res, error.message || 'Failed to refresh AI insights', 500);
    }
};

/**
 * Get spending patterns analysis only
 */
export const getSpendingPatterns = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        logger.info(`Fetching spending patterns for user ${userId}`);

        const patterns = await aiInsightsService.getSpendingPatterns(userId);
        return sendSuccess(res, patterns);
    } catch (error: any) {
        logger.error('Failed to get spending patterns', error);
        return sendError(res, error.message || 'Failed to fetch spending patterns', 500);
    }
};
