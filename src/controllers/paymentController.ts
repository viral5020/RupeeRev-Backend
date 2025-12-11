import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { sendSuccess, sendError } from '../utils/apiResponse';
import User from '../models/user';
import env from '../config/env';
import logger from '../utils/logger';

// Initialize Razorpay
// Initialize Razorpay
let razorpay: any;

const initRazorpay = () => {
    logger.info('Attempting to initialize Razorpay...');
    logger.info(`Key ID present: ${!!env.razorpayKeyId}`);
    logger.info(`Key Secret present: ${!!env.razorpayKeySecret}`);

    if (env.razorpayKeyId && env.razorpayKeySecret) {
        try {
            razorpay = new Razorpay({
                key_id: env.razorpayKeyId,
                key_secret: env.razorpayKeySecret,
            });
            logger.info('Razorpay initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Razorpay:', error);
        }
    } else {
        logger.warn('Razorpay keys not found in environment variables. Payment features will be disabled.');
    }
};

initRazorpay();

// Pricing configuration
const PRICING = {
    PREMIUM_MONTHLY: 14900, // ₹149 in paise
    PREMIUM_YEARLY: 99900,  // ₹999 in paise
    TOKEN_PACK: 4900,       // ₹49 in paise
};

/**
 * Create Razorpay order for Premium Monthly subscription
 */
export const createPremiumOrder = async (req: Request, res: Response) => {
    try {
        if (!razorpay) {
            return sendError(res, 'Payment system not configured', 503);
        }
        const userId = req.user!.id;

        const options = {
            amount: PRICING.PREMIUM_MONTHLY,
            currency: 'INR',
            receipt: `pm_${userId.slice(-6)}_${Date.now()}`,
            notes: {
                userId,
                plan: 'premium_monthly',
            },
        };

        const order = await razorpay.orders.create(options);

        logger.info(`Premium monthly order created: ${order.id} for user ${userId}`);

        return sendSuccess(res, {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: env.razorpayKeyId,
        });
    } catch (error: any) {
        logger.error('Failed to create premium order', error);
        return sendError(res, error.message || 'Failed to create order', 500);
    }
};

/**
 * Create Razorpay order for Premium Annual subscription
 */
export const createAnnualOrder = async (req: Request, res: Response) => {
    try {
        if (!razorpay) {
            return sendError(res, 'Payment system not configured', 503);
        }
        const userId = req.user!.id;

        const options = {
            amount: PRICING.PREMIUM_YEARLY,
            currency: 'INR',
            receipt: `py_${userId.slice(-6)}_${Date.now()}`,
            notes: {
                userId,
                plan: 'premium_yearly',
            },
        };

        const order = await razorpay.orders.create(options);

        logger.info(`Premium yearly order created: ${order.id} for user ${userId}`);

        return sendSuccess(res, {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: env.razorpayKeyId,
        });
    } catch (error: any) {
        logger.error('Failed to create annual order', error);
        return sendError(res, error.message || 'Failed to create order', 500);
    }
};

/**
 * Create Razorpay order for Token Pack
 */
export const createTokenOrder = async (req: Request, res: Response) => {
    try {
        if (!razorpay) {
            return sendError(res, 'Payment system not configured', 503);
        }
        const userId = req.user!.id;

        const options = {
            amount: PRICING.TOKEN_PACK,
            currency: 'INR',
            receipt: `tp_${userId.slice(-6)}_${Date.now()}`,
            notes: {
                userId,
                plan: 'token_pack',
            },
        };

        const order = await razorpay.orders.create(options);

        logger.info(`Token pack order created: ${order.id} for user ${userId}`);

        return sendSuccess(res, {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: env.razorpayKeyId,
        });
    } catch (error: any) {
        logger.error('Failed to create token order', error);
        return sendError(res, error.message || 'Failed to create order', 500);
    }
};

/**
 * Verify Razorpay payment and update user subscription
 */
export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user!.id;

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', env.razorpayKeySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            logger.warn(`Payment verification failed for user ${userId}`);
            return sendError(res, 'Payment verification failed', 400);
        }

        // Fetch order details to get plan type
        const order = await razorpay.orders.fetch(razorpay_order_id);
        const plan = order.notes?.plan;

        const user = await User.findById(userId);
        if (!user) {
            return sendError(res, 'User not found', 404);
        }

        // Update user based on plan
        if (plan === 'premium_monthly') {
            user.isPremium = true;
            user.premiumExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            user.subscriptionId = razorpay_payment_id;
        } else if (plan === 'premium_yearly') {
            user.isPremium = true;
            user.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days
            user.subscriptionId = razorpay_payment_id;
        } else if (plan === 'token_pack') {
            user.tokenBalance += 1; // Add 1 token (1 PDF upload)
            user.hasEverPurchasedTokens = true; // Track that user has purchased tokens
        }

        await user.save();

        logger.info(`Payment verified and user updated: ${userId}, plan: ${plan}`);

        return sendSuccess(res, {
            message: 'Payment verified successfully',
            user: {
                isPremium: user.isPremium,
                premiumExpiresAt: user.premiumExpiresAt,
                tokenBalance: user.tokenBalance,
            },
        });
    } catch (error: any) {
        logger.error('Payment verification error', error);
        return sendError(res, error.message || 'Payment verification failed', 500);
    }
};

/**
 * Get current user's subscription status
 */
export const getSubscriptionStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await User.findById(userId);

        if (!user) {
            return sendError(res, 'User not found', 404);
        }

        return sendSuccess(res, {
            isPremium: user.isPremium,
            premiumExpiresAt: user.premiumExpiresAt,
            tokenBalance: user.tokenBalance,
            subscriptionId: user.subscriptionId,
        });
    } catch (error: any) {
        logger.error('Failed to get subscription status', error);
        return sendError(res, error.message || 'Failed to get subscription status', 500);
    }
};
