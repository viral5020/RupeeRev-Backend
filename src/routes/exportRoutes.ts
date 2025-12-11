import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { csv, excel, pdf } from '../controllers/exportController';

const router = Router();

router.use(authenticate);

router.get('/csv', csv);
router.get('/excel', excel);
router.get('/pdf', pdf);

export default router;

