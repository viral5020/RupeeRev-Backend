import { Types } from 'mongoose';
import Account from '../models/account';
import Transaction from '../models/transaction';
import { IUserDocument } from '../models/user';

export const listAccounts = (user: IUserDocument) => Account.find({ user: user.id }).sort({ createdAt: -1 });

export const createAccount = (user: IUserDocument, payload: { name: string; type: 'bank' | 'cash' | 'wallet'; initialBalance: number; currency?: string }) =>
  Account.create({
    ...payload,
    user: user.id,
    currentBalance: payload.initialBalance,
  });

export const updateAccountBalance = async (accountId: string) => {
  const totals = await Transaction.aggregate([
    { $match: { account: new Types.ObjectId(accountId) } },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
      },
    },
  ]);
  const incomeTotal = totals.find((t) => t._id === 'income')?.total || 0;
  const expenseTotal = totals.find((t) => t._id === 'expense')?.total || 0;
  const account = await Account.findById(accountId);
  if (account) {
    account.currentBalance = account.initialBalance + incomeTotal - expenseTotal;
    await account.save();
  }
};

export const deleteAccount = async (user: IUserDocument, id: string) => {
  const account = await Account.findOne({ _id: id, user: user.id });
  if (!account) throw new Error('Account not found');
  const hasTransactions = await Transaction.exists({ account: id });
  if (hasTransactions) throw new Error('Cannot delete account with transactions');
  await account.deleteOne();
};

