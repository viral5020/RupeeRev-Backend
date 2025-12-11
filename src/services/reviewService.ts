import Review, { IReview } from '../models/review';
import User from '../models/user';
import logger from '../utils/logger';

/**
 * Check if user is eligible to submit a review
 */
export const checkEligibility = async (userId: string): Promise<{ eligible: boolean; reason?: string }> => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            return { eligible: false, reason: 'User not found' };
        }

        const isEligible = user.isPremium || user.hasEverPurchasedTokens;

        if (!isEligible) {
            return {
                eligible: false,
                reason: 'Only premium users or users who have purchased tokens can submit reviews'
            };
        }

        return { eligible: true };
    } catch (error: any) {
        logger.error('Error checking review eligibility', error);
        throw error;
    }
};

/**
 * Create a new review
 */
export const createReview = async (
    userId: string,
    data: { rating: number; content: string; role?: string }
): Promise<IReview> => {
    try {
        // Check eligibility
        const eligibility = await checkEligibility(userId);
        if (!eligibility.eligible) {
            throw new Error(eligibility.reason || 'Not eligible to submit review');
        }

        // Check if user already has a review
        const existingReview = await Review.findOne({ userId });
        if (existingReview) {
            throw new Error('You have already submitted a review. You can edit your existing review.');
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Create review
        const review = new Review({
            userId,
            name: user.name,
            role: data.role || '',
            rating: data.rating,
            content: data.content,
            verified: true,
            isApproved: true,
            avatarUrl: user.avatarUrl || user.avatar,
        });

        await review.save();
        logger.info(`Review created by user ${userId}`);
        return review;
    } catch (error: any) {
        logger.error('Error creating review', error);
        throw error;
    }
};

/**
 * Get all approved reviews
 */
export const getAllReviews = async (): Promise<IReview[]> => {
    try {
        const reviews = await Review.find({ isApproved: true })
            .sort({ createdAt: -1 })
            .lean();
        return reviews;
    } catch (error: any) {
        logger.error('Error fetching reviews', error);
        throw error;
    }
};

/**
 * Get user's review
 */
export const getUserReview = async (userId: string): Promise<IReview | null> => {
    try {
        const review = await Review.findOne({ userId }).lean();
        return review;
    } catch (error: any) {
        logger.error('Error fetching user review', error);
        throw error;
    }
};

/**
 * Update user's review
 */
export const updateReview = async (
    reviewId: string,
    userId: string,
    data: { rating?: number; content?: string; role?: string }
): Promise<IReview> => {
    try {
        const review = await Review.findOne({ _id: reviewId, userId });
        if (!review) {
            throw new Error('Review not found or you do not have permission to edit it');
        }

        if (data.rating !== undefined) review.rating = data.rating;
        if (data.content !== undefined) review.content = data.content;
        if (data.role !== undefined) review.role = data.role;

        await review.save();
        logger.info(`Review ${reviewId} updated by user ${userId}`);
        return review;
    } catch (error: any) {
        logger.error('Error updating review', error);
        throw error;
    }
};

/**
 * Delete user's review
 */
export const deleteReview = async (reviewId: string, userId: string): Promise<void> => {
    try {
        const result = await Review.deleteOne({ _id: reviewId, userId });
        if (result.deletedCount === 0) {
            throw new Error('Review not found or you do not have permission to delete it');
        }
        logger.info(`Review ${reviewId} deleted by user ${userId}`);
    } catch (error: any) {
        logger.error('Error deleting review', error);
        throw error;
    }
};
