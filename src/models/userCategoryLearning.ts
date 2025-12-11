import { Schema, model, Document, Types } from 'mongoose';

export interface IUserCategoryLearning extends Document {
  user: Types.ObjectId;
  pattern: string;
  category: Types.ObjectId;
  hits: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserCategoryLearningSchema = new Schema<IUserCategoryLearning>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pattern: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    hits: { type: Number, default: 1 },
    lastUsed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserCategoryLearningSchema.index({ user: 1, pattern: 1 }, { unique: true });

export const UserCategoryLearning = model<IUserCategoryLearning>(
  'UserCategoryLearning',
  UserCategoryLearningSchema
);
export default UserCategoryLearning;


