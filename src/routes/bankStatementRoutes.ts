import { Router } from 'express';
import multer from 'multer';
import * as bankStatementController from '../controllers/bankStatementController';
import { authenticate } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

import { checkTokenOrPremium } from '../middleware/checkSubscription';

router.post('/upload', authenticate, checkTokenOrPremium, upload.array('pdfs', 10), bankStatementController.uploadBankStatement);

export default router;

