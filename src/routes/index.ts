import { Router } from 'express';
import authRoutes from './authRoutes';
import transactionRoutes from './transactionRoutes';
import categoryRoutes from './categoryRoutes';
import accountRoutes from './accountRoutes';
import budgetRoutes from './budgetRoutes';
import statsRoutes from './statsRoutes';
import notificationRoutes from './notificationRoutes';
import exportRoutes from './exportRoutes';
import investmentRoutes from './investmentRoutes';
import mutualFundRoutes from './mutualFundRoutes';
import stockRoutes from './stockRoutes';
import salaryPlannerRoutes from './salaryPlannerRoutes';
import goalRoutes from '../modules/goals/goal.routes';
import predictionRoutes from './predictionRoutes';
import goalEnhancerRoutes from './goalEnhancerRoutes';
import bankStatementRoutes from './bankStatementRoutes';
import aiInsightsRoutes from './aiInsightsRoutes';
import dashboardRoutes from './dashboardRoutes';
import ipoRoutes from './ipoRoutes';
import paymentRoutes from './paymentRoutes';
import reviewRoutes from './reviewRoutes';
import { requirePremium } from '../middleware/checkSubscription';
import { authenticate } from '../middleware/auth';

const router = Router();

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/categories', categoryRoutes);
router.use('/accounts', accountRoutes);
router.use('/budgets', budgetRoutes);
router.use('/stats', statsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/export', exportRoutes);

// Premium Routes (authenticate first, then check premium)
router.use('/finance', authenticate, requirePremium, investmentRoutes);
router.use('/investments', authenticate, requirePremium, investmentRoutes);
router.use('/mutualfunds', authenticate, requirePremium, mutualFundRoutes);
router.use('/stocks', authenticate, requirePremium, stockRoutes);
router.use('/salary-planner', authenticate, requirePremium, salaryPlannerRoutes);
router.use('/ipos', authenticate, requirePremium, ipoRoutes);

router.use('/goals', goalRoutes);
router.use('/predictions', predictionRoutes);
router.use('/goal-enhancer', goalEnhancerRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/bank-statement', bankStatementRoutes);
router.use('/ai', aiInsightsRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);

export default router;
