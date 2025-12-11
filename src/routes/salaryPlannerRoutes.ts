import { Router } from 'express';
import * as salaryPlannerController from '../controllers/salaryPlannerController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/detect', salaryPlannerController.detectSalary);
router.post('/plan', salaryPlannerController.generateSalaryPlan);

export default router;
