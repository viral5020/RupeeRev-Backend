import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import * as goalController from './goal.controller';

const router = Router();

const goalSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    targetAmount: z.number().positive(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

const updateGoalSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      targetAmount: z.number().positive().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      status: z.enum(['in-progress', 'achievable', 'completed']).optional(),
    })
    .partial(),
  params: z.object({ id: z.string() }),
  query: z.object({}).optional(),
});

router.use(authenticate);

router.get('/', goalController.listGoals);
router.post('/', validateRequest(goalSchema), goalController.createGoal);
router.put('/:id', validateRequest(updateGoalSchema), goalController.updateGoal);
router.delete('/:id', goalController.deleteGoal);

export default router;



