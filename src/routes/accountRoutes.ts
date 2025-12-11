import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { create, getAccounts, remove } from '../controllers/accountController';

const router = Router();

router.use(authenticate);

router.get('/', getAccounts);

router.post(
  '/',
  validateRequest(
    z.object({
      body: z.object({
        name: z.string(),
        type: z.enum(['bank', 'cash', 'wallet']),
        initialBalance: z.number(),
        currency: z.string().optional(),
      }),
    })
  ),
  create
);

router.delete('/:id', remove);

export default router;

