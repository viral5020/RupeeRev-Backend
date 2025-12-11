import { Router } from 'express';
import * as predictionController from '../controllers/predictionController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/category-spike', predictionController.getCategorySpike);
router.get('/overspending-warning', predictionController.getOverspendingWarning);
router.get('/subscriptions', predictionController.getSubscriptionPredictions);
router.get('/repeated-merchants', predictionController.getRepeatedMerchants);
router.get('/ai-forecast', predictionController.getAIPrediction);
router.get('/bills', predictionController.getPredictedBills);
router.get('/ai-insights', predictionController.getAIInsights);

export default router;

