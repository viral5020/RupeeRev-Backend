import { Schema, model, Document, Types } from 'mongoose';

export type AccountType = 'bank' | 'cash' | 'wallet';

export interface IAccountDocument extends Document {
  name: string;
  type: AccountType;
  user: Types.ObjectId;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  provider?: string;
}

const AccountSchema = new Schema<IAccountDocument>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['bank', 'cash', 'wallet'], required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    initialBalance: { type: Number, required: true },
    currentBalance: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    provider: String,
  },
  { timestamps: true }
);

AccountSchema.pre('save', function updateBalance(next) {
  if (!this.currentBalance) {
    this.currentBalance = this.initialBalance;
  }
  next();
});

export const Account = model<IAccountDocument>('Account', AccountSchema);
export default Account;

