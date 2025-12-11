import { Request, Response } from 'express';
import { createTransaction, deleteTransaction, deleteAllTransactions, listTransactions, updateTransaction } from '../services/transactionService';
import { processPDFImport } from '../services/pdfImportService';
import { sendSuccess } from '../utils/apiResponse';
import { promises as fs } from 'fs';

const normalizePayload = (body: any) => {
  const payload = { ...body };
  if (typeof payload.amount === 'string') {
    payload.amount = Number(payload.amount);
  }
  if (typeof payload.date === 'string') {
    payload.date = payload.date;
  }
  if (typeof payload.recurrence === 'string') {
    try {
      payload.recurrence = JSON.parse(payload.recurrence);
    } catch (error) {
      payload.recurrence = undefined;
    }
  }
  return payload;
};

export const getTransactions = async (req: Request, res: Response) => {
  const result = await listTransactions(req.user!, req.query);
  return sendSuccess(res, result);
};

export const create = async (req: Request, res: Response) => {
  const transaction = await createTransaction(req.user!, normalizePayload(req.body), req.files as Express.Multer.File[]);
  return sendSuccess(res, transaction, 'Transaction created', 201);
};

export const update = async (req: Request, res: Response) => {
  const transaction = await updateTransaction(req.user!, req.params.id, normalizePayload(req.body), req.files as Express.Multer.File[]);
  return sendSuccess(res, transaction, 'Transaction updated');
};

export const remove = async (req: Request, res: Response) => {
  await deleteTransaction(req.user!, req.params.id);
  return sendSuccess(res, { ok: true }, 'Transaction deleted');
};

export const removeAll = async (req: Request, res: Response) => {
  const result = await deleteAllTransactions(req.user!);
  return sendSuccess(res, result, `Deleted ${result.deletedCount} transactions`);
};

export const importFromPDF = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  try {
    // Read the uploaded file
    const pdfBuffer = await fs.readFile(req.file.path);

    // Process the PDF
    const result = await processPDFImport(pdfBuffer, req.user!.id, req.file.path);

    return sendSuccess(res, result, 'PDF processed successfully');
  } catch (error) {
    console.error('PDF import error:', error);

    // Clean up the file if it still exists
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        // Ignore unlink errors
      }
    }

    throw error;
  }
};

