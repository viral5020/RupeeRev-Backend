import { Router } from 'express';
import { z } from 'zod';
import * as stockController from '../controllers/stockController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/stocks - Get all stock recommendations with optional filters
router.get('/', stockController.getStocks);

// GET /api/stocks/top - Get top stock picks
router.get('/top', stockController.getTopStocks);

// GET /api/stocks/by-sector - Get stocks grouped by sector
router.get('/by-sector', stockController.getStocksBySector);

// GET /api/stocks/:symbol - Get specific stock details
router.get('/:symbol', stockController.getStockDetail);

// POST /api/stocks/portfolio-suggestion - Get personalized portfolio suggestion
const portfolioSchema = z.object({
    body: z.object({
        investmentAmount: z.number().min(1000),
        riskLevel: z.enum(['low', 'medium', 'high']),
    }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
});

router.post(
    '/portfolio-suggestion',
    validateRequest(portfolioSchema),
    stockController.getPortfolioSuggestion
);

// POST /api/stocks/update-prices - Manually trigger stock price update
router.post('/update-prices', stockController.updateStockPrices);

export default router;
