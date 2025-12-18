import { Router } from 'express';
import { authenticate as protect } from '../middleware/auth';
import { listReports, downloadReport, emailReport } from '../controllers/reportController';

const router = Router();

// Protect all routes
router.use(protect);

router.get('/', listReports);
router.get('/download/:reportId', downloadReport);
router.post('/email', emailReport);

export default router;
