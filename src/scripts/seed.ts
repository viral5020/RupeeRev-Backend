import { connectDB } from '../config/db';
import Category from '../models/category';
import Account from '../models/account';
import User from '../models/user';
import Transaction from '../models/transaction';
import env from '../config/env';

const defaultCategories = [
  { name: 'Food', type: 'expense', color: '#f97316', icon: '🍔' },
  { name: 'Travel', type: 'expense', color: '#6366f1', icon: '✈️' },
  { name: 'Bills', type: 'expense', color: '#ef4444', icon: '💡' },
  { name: 'Shopping', type: 'expense', color: '#ec4899', icon: '🛍️' },
  { name: 'Salary', type: 'income', color: '#22c55e', icon: '💼' },
  { name: 'Investment', type: 'income', color: '#0ea5e9', icon: '📈' },
];

const seed = async () => {
  await connectDB();
  console.log('Seeding default categories...');
  for (const category of defaultCategories) {
    await Category.updateOne({ name: category.name, user: null }, { ...category, user: null, isDefault: true }, { upsert: true });
  }
  if (!env.masterPassword) {
    console.warn('Master password not configured. Skipping admin user seed.');
    process.exit(0);
  }
  const adminEmail = 'admin@money.app';
  if (!(await User.findOne({ email: adminEmail }))) {
    console.log('Creating admin user...');
    await User.create({ name: 'Admin', email: adminEmail, password: env.masterPassword, roles: ['admin'] });
  }
  const user = await User.findOne({ email: adminEmail });
  if (user) {
    let account = await Account.findOne({ user: user._id, name: 'Bank Account' });
    if (!account) {
      account = await Account.create({ user: user._id, name: 'Bank Account', type: 'bank', initialBalance: 5000, currentBalance: 5000, currency: 'USD' });
    }
    const salary = await Category.findOne({ name: 'Salary' });
    const food = await Category.findOne({ name: 'Food' });
    if ((await Transaction.countDocuments({ user: user._id })) === 0 && salary && food && account) {
      await Transaction.create([
        {
          user: user._id,
          title: 'Monthly Salary',
          amount: 7000,
          category: salary._id,
          account: account._id,
          date: new Date(),
          type: 'income',
        },
        {
          user: user._id,
          title: 'Groceries',
          amount: 200,
          category: food._id,
          account: account._id,
          date: new Date(),
          type: 'expense',
        },
      ]);
    }
  }
  console.log('Seed completed');
  process.exit(0);
};

seed();

