import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';
import User from '../models/user';

/**
 * Middleware to check if user has a premium subscription
 */
export const requirePremium = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return sendError(res, 'Unauthorized', 401);
        }

        const user = await User.findById(userId);
        if (!user) {
            return sendError(res, 'User not found', 404);
        }

        // Check if premium is active
        if (user.isPremium) {
            // Check expiry if set
            if (user.premiumExpiresAt && new Date() > user.premiumExpiresAt) {
                // Expired
                user.isPremium = false;
                await user.save();
                return sendError(res, 'Premium subscription expired', 403);
            }
            return next();
        }

        return sendError(res, 'Premium subscription required', 403);
    } catch (error) {
        return sendError(res, 'Internal server error', 500);
    }
};

/**
 * Middleware to check if user has premium OR tokens
 * Used for pay-per-use features like PDF import
 */
export const checkTokenOrPremium = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return sendError(res, 'Unauthorized', 401);
        }

        const user = await User.findById(userId);
        if (!user) {
            return sendError(res, 'User not found', 404);
        }

        // Allow if premium
        if (user.isPremium) {
            if (user.premiumExpiresAt && new Date() > user.premiumExpiresAt) {
                user.isPremium = false;
                await user.save();
            } else {
                return next();
            }
        }

        // Allow if has tokens
        if (user.tokenBalance > 0) {
            return next();
        }

        return sendError(res, 'Premium subscription or tokens required', 403);
    } catch (error) {
        return sendError(res, 'Internal server error', 500);
    }
};

/**
 * Helper to deduct a token after successful operation
 * Call this manually in the controller
 */
export const deductToken = async (userId: string): Promise<boolean> => {
    const user = await User.findById(userId);
    if (!user) return false;

    // Check if premium
    if (user.isPremium) {
        // Initialize if missing
        if (!user.monthlyPdfUploads) {
            user.monthlyPdfUploads = { count: 0, lastReset: new Date() };
        }

        const now = new Date();
        const lastReset = new Date(user.monthlyPdfUploads.lastReset);

        // Check if we need to reset (new month)
        if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
            user.monthlyPdfUploads.count = 0;
            user.monthlyPdfUploads.lastReset = now;
        }

        // Check limit (5 per month)
        if (user.monthlyPdfUploads.count < 5) {
            user.monthlyPdfUploads.count += 1;
            await user.save();
            return true;
        }

        // If limit exceeded, fall through to token deduction
    }

    // Deduct token if available
    if (user.tokenBalance > 0) {
        user.tokenBalance -= 1;
        await user.save();
        return true;
    }

    return false;
};
