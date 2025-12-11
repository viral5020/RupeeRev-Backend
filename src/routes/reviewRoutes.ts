import { Router } from 'express';
import * as reviewController from '../controllers/reviewController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', reviewController.getAllReviews);

// Protected routes (require authentication)
router.get('/eligibility', authenticate, reviewController.checkEligibility);
router.get('/my-review', authenticate, reviewController.getMyReview);
router.post('/', authenticate, reviewController.createReview);
router.put('/:id', authenticate, reviewController.updateReview);
router.delete('/:id', authenticate, reviewController.deleteReview);

export default router;
