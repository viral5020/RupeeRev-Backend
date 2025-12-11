import { Router } from 'express';
import { z } from 'zod';
import * as investmentController from '../controllers/investmentController';
import * as mutualFundController from '../controllers/mutualFundController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

const aiRecommendationSchema = z.object({
    body: z.object({
        surplus: z.number().min(0),
        riskLevel: z.enum(['low', 'medium', 'high']),
    }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
});

router.post(
    '/recommend',
    validateRequest(aiRecommendationSchema),
    mutualFundController.recommendInvestment
);

// GET /api/finance/surplus - Get monthly surplus
router.get('/surplus', investmentController.getSurplus);

// GET /api/investments/profile - Get financial profile
router.get('/profile', investmentController.getFinancialProfile);

// PUT /api/investments/profile - Update financial profile
router.put('/profile', investmentController.updateProfile);

// POST /api/investments/suggestions - Get investment suggestions
const suggestionsSchema = z.object({
    body: z.object({
        surplus: z.number().min(0),
        riskLevel: z.enum(['low', 'medium', 'high']),
    }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
});

router.post(
    '/suggestions',
    validateRequest(suggestionsSchema),
    investmentController.getInvestmentSuggestions
);

// PUT /api/investments/risk-level - Update risk level
const riskLevelSchema = z.object({
    body: z.object({
        riskLevel: z.enum(['low', 'medium', 'high']),
        isAuto: z.boolean(),
    }),
    query: z.object({}).optional(),
    params: z.object({}).optional(),
});

router.put(
    '/risk-level',
    validateRequest(riskLevelSchema),
    investmentController.updateRiskLevel
);

export default router;
