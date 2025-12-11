import { Router } from 'express';
import * as goalEnhancerController from '../controllers/goalEnhancerController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/:goalId/confidence', goalEnhancerController.getGoalConfidence);
router.get('/salary-increase', goalEnhancerController.detectSalaryIncrease);
router.put('/:goalId/fix-timeline', goalEnhancerController.fixSipTimeline);

export default router;

