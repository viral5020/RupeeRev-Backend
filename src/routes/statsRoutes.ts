import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { monthly, category } from '../controllers/statsController';

const router = Router();

router.use(authenticate);

router.get('/monthly', monthly);
router.get('/category', category);

export default router;

