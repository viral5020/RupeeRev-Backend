import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { create, getCategories, remove, update } from '../controllers/categoryController';

const router = Router();

const bodySchema = z.object({
  name: z.string().min(2),
  type: z.enum(['income', 'expense']),
  color: z.string(),
  icon: z.string(),
});

router.use(authenticate);

router.get('/', getCategories);
router.post('/', validateRequest(z.object({ body: bodySchema })), create);
router.put('/:id', validateRequest(z.object({ body: bodySchema.partial(), params: z.object({ id: z.string() }) })), update);
router.delete('/:id', remove);

export default router;

