import { Request, Response } from 'express';
import { createAccount, deleteAccount, listAccounts } from '../services/accountService';
import { sendSuccess } from '../utils/apiResponse';

export const getAccounts = async (req: Request, res: Response) => {
  const accounts = await listAccounts(req.user!);
  return sendSuccess(res, accounts);
};

export const create = async (req: Request, res: Response) => {
  const account = await createAccount(req.user!, req.body);
  return sendSuccess(res, account, 'Account created', 201);
};

export const remove = async (req: Request, res: Response) => {
  await deleteAccount(req.user!, req.params.id);
  return sendSuccess(res, { ok: true }, 'Account deleted');
};

