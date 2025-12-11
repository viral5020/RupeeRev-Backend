import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import * as investmentService from '../services/investmentService';
import { allocateSurplusToGoals } from '../modules/goals/goal.service';

export const getSurplus = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { month, year } = req.query;

    const surplus = await investmentService.calculateSurplus(
        userId,
        month ? parseInt(month as string) : undefined,
        year ? parseInt(year as string) : undefined
    );

    const profile = await investmentService.getFinancialProfile(userId);
    const allocationSurplus = profile?.manualSurplus ?? surplus.surplus;

    await allocateSurplusToGoals(userId, allocationSurplus, profile?.riskLevel || 'medium');

    return sendSuccess(res, { ...surplus, manualSurplus: profile?.manualSurplus });
};

export const getInvestmentSuggestions = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { surplus, riskLevel } = req.body;

    const suggestions = await investmentService.getInvestmentSuggestions(
        surplus,
        riskLevel
    );

    return sendSuccess(res, suggestions);
};

export const getFinancialProfile = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const profile = await investmentService.getFinancialProfile(userId);
    return sendSuccess(res, profile);
};

export const updateRiskLevel = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { riskLevel, isAuto } = req.body;

    const profile = await investmentService.updateRiskLevel(userId, riskLevel, isAuto);
    return sendSuccess(res, profile);
};

export const updateProfile = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { manualSurplus } = req.body;
    await investmentService.updateFinancialProfile(userId, manualSurplus);
    const profile = await investmentService.getFinancialProfile(userId);
    return sendSuccess(res, profile);
};
