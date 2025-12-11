import { Schema, model, Document, Types } from 'mongoose';

export interface ICategoryBudget {
  category: Types.ObjectId;
  limit: number;
  spent: number;
}

export interface IBudgetDocument extends Document {
  user: Types.ObjectId;
  month: number;
  year: number;
  totalLimit: number;
  totalSpent: number;
  categoryBudgets: ICategoryBudget[];
}

const CategoryBudgetSchema = new Schema<ICategoryBudget>(
  {
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    limit: { type: Number, required: true },
    spent: { type: Number, default: 0 },
  },
  { _id: false }
);

const BudgetSchema = new Schema<IBudgetDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    totalLimit: { type: Number, required: true },
    totalSpent: { type: Number, default: 0 },
    categoryBudgets: { type: [CategoryBudgetSchema], default: [] },
  },
  { timestamps: true }
);

BudgetSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

export const Budget = model<IBudgetDocument>('Budget', BudgetSchema);
export default Budget;

