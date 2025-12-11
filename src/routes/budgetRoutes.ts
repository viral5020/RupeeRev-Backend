import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { get, upsert } from '../controllers/budgetController';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validateRequest(
    z.object({
      query: z.object({
        month: z.string(),
        year: z.string(),
      }),
    })
  ),
  get
);

router.post(
  '/',
  validateRequest(
    z.object({
      body: z.object({
        month: z.number().min(1).max(12),
        year: z.number().min(2000),
        totalLimit: z.number().positive(),
        categoryBudgets: z.array(
          z.object({
            category: z.string(),
            limit: z.number().positive(),
          })
        ),
      }),
    })
  ),
  upsert
);

export default router;

