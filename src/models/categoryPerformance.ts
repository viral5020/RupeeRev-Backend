import { Schema, model, Document } from 'mongoose';

export interface ICategoryPerformanceDocument extends Document {
  category: string;
  normalizedCategory: 'index' | 'equity' | 'balanced' | 'gold' | 'debt';
  avg1Month: number;
  avg3Month: number;
  avg1Year: number;
  updatedAt: Date;
}

const CategoryPerformanceSchema = new Schema<ICategoryPerformanceDocument>(
  {
    category: { type: String, required: true, unique: true },
    normalizedCategory: {
      type: String,
      enum: ['index', 'equity', 'balanced', 'gold', 'debt'],
      required: true,
      unique: true,
    },
    avg1Month: { type: Number, default: 0 },
    avg3Month: { type: Number, default: 0 },
    avg1Year: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const CategoryPerformance = model<ICategoryPerformanceDocument>(
  'CategoryPerformance',
  CategoryPerformanceSchema
);

export default CategoryPerformance;


