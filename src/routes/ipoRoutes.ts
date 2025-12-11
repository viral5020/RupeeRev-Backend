import { Router } from 'express';
import * as ipoController from '../controllers/ipoController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Seed route (development only - should be protected in production)
router.post('/seed', ipoController.seedIPOData);

// Public routes (no auth required for viewing IPOs)
router.get('/', ipoController.listIPOs);
router.get('/upcoming', ipoController.getUpcomingIPOs);
router.get('/:id', ipoController.getIPOById);

// Protected routes (require authentication)
router.use(authenticate);
router.post('/watchlist/add', ipoController.addToWatchlist);
router.post('/watchlist/remove', ipoController.removeFromWatchlist);
router.get('/watchlist/list', ipoController.getUserWatchlist);
router.get('/watchlist/status/:ipoId', ipoController.checkWatchlistStatus);

export default router;
