import { Schema, model, Document, Types } from 'mongoose';

export interface ICategoryDocument extends Document {
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  user: Types.ObjectId | null;
  isDefault: boolean;
}

const CategorySchema = new Schema<ICategoryDocument>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    color: { type: String, required: true },
    icon: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1, user: 1 }, { unique: true });

export const Category = model<ICategoryDocument>('Category', CategorySchema);
export default Category;

