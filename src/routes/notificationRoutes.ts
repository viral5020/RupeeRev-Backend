import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { list, markRead } from '../controllers/notificationController';

const router = Router();

router.use(authenticate);

router.get('/', list);
router.post('/:id/read', markRead);

export default router;

