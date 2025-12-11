import { Router } from 'express';
import * as aiInsightsController from '../controllers/aiInsightsController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/insights', aiInsightsController.getAiInsights);
router.post('/insights/refresh', aiInsightsController.refreshAiInsights);
router.get('/spending-patterns', aiInsightsController.getSpendingPatterns);

export default router;
