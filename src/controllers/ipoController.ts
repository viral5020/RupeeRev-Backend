import { Request, Response } from 'express';
import * as ipoService from '../services/ipoService';
import { sendSuccess, sendError } from '../utils/apiResponse';

export const seedIPOData = async (req: Request, res: Response) => {
    try {
        await ipoService.seedIPOData();
        return sendSuccess(res, null, 'IPO data seeded successfully');
    } catch (error: any) {
        return sendError(res, error.message);
    }
};

export const listIPOs = async (req: Request, res: Response) => {
    try {
        const filters = {
            status: req.query.status as any,
            industry: req.query.industry as string,
            search: req.query.search as string,
        };
        const ipos = await ipoService.listIPOs(filters);
        return sendSuccess(res, ipos);
    } catch (error: any) {
        return sendError(res, error.message);
    }
};

export const getIPOById = async (req: Request, res: Response) => {
    try {
        const ipo = await ipoService.getIPOById(req.params.id);
        if (!ipo) {
            return sendError(res, 'IPO not found', 404);
        }
        return sendSuccess(res, ipo);
    } catch (error: any) {
        return sendError(res, error.message);
    }
};

export const getUpcomingIPOs = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 3;
        const ipos = await ipoService.getUpcomingIPOs(limit);
        return sendSuccess(res, ipos);
    } catch (error: any) {
        return sendError(res, error.message);
    }
};

export const addToWatchlist = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { ipoId } = req.body;
        const watchlistItem = await ipoService.addToWatchlist(user, ipoId);
        return sendSuccess(res, watchlistItem, 'Added to watchlist');
    } catch (error: any) {
        return sendError(res, error.message);
    }
};

export const removeFromWatchlist = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { ipoId } = req.body;
        await ipoService.removeFromWatchlist(user, ipoId);
        return sendSuccess(res, null, 'Removed from watchlist');
    } catch (error: any) {
        return sendError(res, error.message);
    }
};

export const getUserWatchlist = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const watchlist = await ipoService.getUserWatchlist(user);
        return sendSuccess(res, watchlist);
    } catch (error: any) {
        return sendError(res, error.message);
    }
};

export const checkWatchlistStatus = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { ipoId } = req.params;
        const inWatchlist = await ipoService.isInWatchlist(user, ipoId);
        return sendSuccess(res, { inWatchlist });
    } catch (error: any) {
        return sendError(res, error.message);
    }
};
