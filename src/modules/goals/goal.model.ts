import { Schema, model, Document, Types } from 'mongoose';

export type GoalPriority = 'high' | 'medium' | 'low';
export type GoalStatus = 'in-progress' | 'achievable' | 'completed';

export interface IGoalDocument extends Document {
  userId: Types.ObjectId;
  name: string;
  targetAmount: number;
  priority: GoalPriority;
  monthlyContribution: number;
  expectedMonths: number;
  expectedYears: number;
  categorySuggested: string;
  minimumTenureApplied?: boolean;
  note?: string;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

const GoalSchema = new Schema<IGoalDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    monthlyContribution: { type: Number, default: 0 },
    expectedMonths: { type: Number, default: 0 },
    expectedYears: { type: Number, default: 0 },
    categorySuggested: { type: String, default: 'index' },
    minimumTenureApplied: { type: Boolean, default: false },
    note: { type: String },
    status: { type: String, enum: ['in-progress', 'achievable', 'completed'], default: 'in-progress' },
  },
  { timestamps: true }
);

GoalSchema.index({ userId: 1, priority: 1 });

export const Goal = model<IGoalDocument>('Goal', GoalSchema);
export default Goal;



