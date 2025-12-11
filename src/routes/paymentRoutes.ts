import { Router } from 'express';
import {
    createPremiumOrder,
    createAnnualOrder,
    createTokenOrder,
    verifyPayment,
    getSubscriptionStatus,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All payment routes require authentication
router.post('/create-premium-order', authenticate, createPremiumOrder);
router.post('/create-annual-order', authenticate, createAnnualOrder);
router.post('/create-token-order', authenticate, createTokenOrder);
router.post('/verify', authenticate, verifyPayment);
router.get('/subscription-status', authenticate, getSubscriptionStatus);

export default router;
