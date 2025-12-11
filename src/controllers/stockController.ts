import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import * as stockService from '../services/stockService';

export const getStocks = async (req: Request, res: Response) => {
    const { sector, marketCap, riskLevel, investmentHorizon, minUpside } = req.query;

    const filters: any = {};
    if (sector) filters.sector = sector;
    if (marketCap) filters.marketCap = marketCap;
    if (riskLevel) filters.riskLevel = riskLevel;
    if (investmentHorizon) filters.investmentHorizon = investmentHorizon;
    if (minUpside) filters.minUpside = parseFloat(minUpside as string);

    const stocks = await stockService.getStockRecommendations(filters);
    return sendSuccess(res, stocks);
};

export const getStockDetail = async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const stock = await stockService.getStockBySymbol(symbol);

    if (!stock) {
        return res.status(404).json({ success: false, message: 'Stock not found' });
    }

    return sendSuccess(res, stock);
};

export const getTopStocks = async (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const stocks = await stockService.getTopPicks(limit);
    return sendSuccess(res, stocks);
};

export const getStocksBySector = async (req: Request, res: Response) => {
    const grouped = await stockService.getStocksBySector();
    return sendSuccess(res, grouped);
};

export const getPortfolioSuggestion = async (req: Request, res: Response) => {
    const { investmentAmount, riskLevel } = req.body;

    if (!investmentAmount || !riskLevel) {
        return res.status(400).json({
            success: false,
            message: 'Investment amount and risk level are required'
        });
    }

    const portfolio = await stockService.getPortfolioSuggestion(
        parseFloat(investmentAmount),
        riskLevel
    );

    return sendSuccess(res, portfolio);
};

export const updateStockPrices = async (req: Request, res: Response) => {
    const { updateStockPricesNow } = await import('../jobs/stockPriceUpdate');
    const result = await updateStockPricesNow();
    return sendSuccess(res, result, 'Stock prices updated successfully');
};
