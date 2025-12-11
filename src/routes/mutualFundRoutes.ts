import { Router } from 'express';
import * as mutualFundController from '../controllers/mutualFundController';

const router = Router();

router.get('/categories/performance', mutualFundController.listCategoryPerformance);

export default router;


