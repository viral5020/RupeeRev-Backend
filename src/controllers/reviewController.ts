import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/apiResponse';
import * as reviewService from '../services/reviewService';
import logger from '../utils/logger';

/**
 * Check if current user is eligible to submit a review
 */
export const checkEligibility = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const eligibility = await reviewService.checkEligibility(userId);
        return sendSuccess(res, eligibility);
    } catch (error: any) {
        logger.error('Error checking eligibility', error);
        return sendError(res, error.message || 'Failed to check eligibility', 500);
    }
};

/**
 * Create a new review
 */
export const createReview = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { rating, content, role } = req.body;

        // Validation
        if (!rating || rating < 1 || rating > 5) {
            return sendError(res, 'Rating must be between 1 and 5', 400);
        }

        if (!content || content.trim().length < 10) {
            return sendError(res, 'Review content must be at least 10 characters', 400);
        }

        if (content.trim().length > 500) {
            return sendError(res, 'Review content must not exceed 500 characters', 400);
        }

        if (role && role.length > 50) {
            return sendError(res, 'Role must not exceed 50 characters', 400);
        }

        const review = await reviewService.createReview(userId, {
            rating,
            content: content.trim(),
            role: role?.trim(),
        });

        logger.info(`Review created successfully by user ${userId}`);
        return sendSuccess(res, { review }, 'Review submitted successfully', 201);
    } catch (error: any) {
        logger.error('Error creating review', error);

        // Handle specific errors
        if (error.message.includes('already submitted')) {
            return sendError(res, error.message, 409);
        }
        if (error.message.includes('Not eligible')) {
            return sendError(res, error.message, 403);
        }

        return sendError(res, error.message || 'Failed to create review', 500);
    }
};

/**
 * Get all approved reviews
 */
export const getAllReviews = async (req: Request, res: Response) => {
    try {
        const reviews = await reviewService.getAllReviews();
        return sendSuccess(res, { reviews, count: reviews.length });
    } catch (error: any) {
        logger.error('Error fetching reviews', error);
        return sendError(res, error.message || 'Failed to fetch reviews', 500);
    }
};

/**
 * Get current user's review
 */
export const getMyReview = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const review = await reviewService.getUserReview(userId);

        if (!review) {
            return sendSuccess(res, { review: null, hasReview: false });
        }

        return sendSuccess(res, { review, hasReview: true });
    } catch (error: any) {
        logger.error('Error fetching user review', error);
        return sendError(res, error.message || 'Failed to fetch review', 500);
    }
};

/**
 * Update user's review
 */
export const updateReview = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { rating, content, role } = req.body;

        // Validation
        if (rating !== undefined && (rating < 1 || rating > 5)) {
            return sendError(res, 'Rating must be between 1 and 5', 400);
        }

        if (content !== undefined && content.trim().length < 10) {
            return sendError(res, 'Review content must be at least 10 characters', 400);
        }

        if (content !== undefined && content.trim().length > 500) {
            return sendError(res, 'Review content must not exceed 500 characters', 400);
        }

        if (role !== undefined && role.length > 50) {
            return sendError(res, 'Role must not exceed 50 characters', 400);
        }

        const review = await reviewService.updateReview(id, userId, {
            rating,
            content: content?.trim(),
            role: role?.trim(),
        });

        logger.info(`Review ${id} updated by user ${userId}`);
        return sendSuccess(res, { review }, 'Review updated successfully');
    } catch (error: any) {
        logger.error('Error updating review', error);

        if (error.message.includes('not found') || error.message.includes('permission')) {
            return sendError(res, error.message, 404);
        }

        return sendError(res, error.message || 'Failed to update review', 500);
    }
};

/**
 * Delete user's review
 */
export const deleteReview = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        await reviewService.deleteReview(id, userId);

        logger.info(`Review ${id} deleted by user ${userId}`);
        return sendSuccess(res, null, 'Review deleted successfully');
    } catch (error: any) {
        logger.error('Error deleting review', error);

        if (error.message.includes('not found') || error.message.includes('permission')) {
            return sendError(res, error.message, 404);
        }

        return sendError(res, error.message || 'Failed to delete review', 500);
    }
};
