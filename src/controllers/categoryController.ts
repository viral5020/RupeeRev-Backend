import { Request, Response } from 'express';
import { createCategory, listCategories, removeCategory, updateCategory } from '../services/categoryService';
import { sendSuccess } from '../utils/apiResponse';

export const getCategories = async (req: Request, res: Response) => {
  const categories = await listCategories(req.user!);
  return sendSuccess(res, categories);
};

export const create = async (req: Request, res: Response) => {
  const category = await createCategory(req.user!, req.body);
  return sendSuccess(res, category, 'Category created', 201);
};

export const update = async (req: Request, res: Response) => {
  const category = await updateCategory(req.user!, req.params.id, req.body);
  return sendSuccess(res, category, 'Category updated');
};

export const remove = async (req: Request, res: Response) => {
  await removeCategory(req.user!, req.params.id);
  return sendSuccess(res, { ok: true }, 'Category removed');
};

