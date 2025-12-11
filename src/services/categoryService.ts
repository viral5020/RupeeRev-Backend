import Category from '../models/category';
import { IUserDocument } from '../models/user';

export const listCategories = (user: IUserDocument) => {
  return Category.find({ $or: [{ user: null }, { user: user.id }] }).sort({ name: 1 });
};

export const createCategory = (user: IUserDocument, payload: { name: string; type: 'income' | 'expense'; color: string; icon: string }) => {
  return Category.create({ ...payload, user: user.id });
};

export const updateCategory = async (user: IUserDocument, id: string, payload: Partial<{ name: string; color: string; icon: string }>) => {
  const category = await Category.findOneAndUpdate({ _id: id, $or: [{ user: user.id }, { user: null }] }, payload, { new: true });
  if (!category) throw new Error('Category not found');
  return category;
};

export const removeCategory = async (user: IUserDocument, id: string) => {
  const category = await Category.findOne({ _id: id, user: user.id });
  if (!category) throw new Error('Category not found');
  await category.deleteOne();
  return true;
};

