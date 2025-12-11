import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { receiptUpload } from '../storage/receiptStorage';
import { create, getTransactions, remove, removeAll, update, importFromPDF } from '../controllers/transactionController';

const router = Router();

const recurrenceSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  endDate: z.string().optional(),
  remainingOccurrences: z.coerce.number().optional(),
});

const baseBody = {
  title: z.string().min(2),
  amount: z.coerce.number().positive(),
  category: z.string(),
  // account: z.string(), // Removed - account field no longer exists in transaction model
  date: z.string().optional(),
  notes: z.string().optional(),
  type: z.enum(['income', 'expense']),
  tags: z.array(z.string()).optional(),
  recurrence: z.union([recurrenceSchema, z.string()]).optional(),
};

const createSchema = z.object({
  body: z.object(baseBody),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateSchema = z.object({
  body: z.object(baseBody).partial(),
  params: z.object({ id: z.string() }),
  query: z.object({}).optional(),
});

const listSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    type: z.enum(['income', 'expense']).optional(),
    category: z.string().optional(),
    // account: z.string().optional(), // Removed
    minAmount: z.string().optional(),
    maxAmount: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

router.use(authenticate);

router.get('/', validateRequest(listSchema), getTransactions);
router.post('/', receiptUpload.array('attachments', 5), validateRequest(createSchema), create);
router.post('/import-pdf', receiptUpload.single('pdf'), importFromPDF);
router.put('/:id', receiptUpload.array('attachments', 5), validateRequest(updateSchema), update);
router.delete('/:id', remove);
router.delete('/', removeAll);

export default router;

