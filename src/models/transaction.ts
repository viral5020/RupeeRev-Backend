import { Schema, model, Document, Types } from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

export type TransactionType = 'income' | 'expense';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface IAttachment {
  url: string;
  provider: 'local' | 'cloudinary';
  filename: string;
  size: number;
  mimetype: string;
}

export interface IRecurrence {
  frequency: RecurrenceFrequency;
  nextRun: Date;
  endDate?: Date;
  remainingOccurrences?: number;
}

export interface ITransactionDocument extends Document {
  user: Types.ObjectId;
  title: string;
  amount: number;
  category: string;
  // account: Types.ObjectId;
  date: Date;
  notes?: string;
  type: TransactionType;
  attachments: IAttachment[];
  recurrence?: IRecurrence;
  isRecurring: boolean;
  tags: string[];
  source?: string;
  importedAt?: Date;
  categorySource?: 'rule' | 'llm' | 'learning' | 'recurrence' | 'manual';
  categoryConfidence?: number;
  importBatchId?: string;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    provider: { type: String, enum: ['local', 'cloudinary'], default: 'local' },
    filename: String,
    size: Number,
    mimetype: String,
  },
  { _id: false }
);

const RecurrenceSchema = new Schema<IRecurrence>(
  {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
    nextRun: { type: Date, required: true },
    endDate: Date,
    remainingOccurrences: Number,
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransactionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    // account: { type: Schema.Types.ObjectId, ref: 'Account' }, // Removed account field
    date: { type: Date, default: Date.now },
    notes: String,
    type: { type: String, enum: ['income', 'expense'], required: true },
    attachments: { type: [AttachmentSchema], default: [] },
    recurrence: RecurrenceSchema,
    isRecurring: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    source: { type: String },
    importedAt: { type: Date },
    categorySource: { type: String },
    categoryConfidence: { type: Number },
    importBatchId: { type: String, index: true },
  },
  { timestamps: true }
);

TransactionSchema.index({ title: 'text', notes: 'text' });

TransactionSchema.plugin(aggregatePaginate);

export const Transaction = model<ITransactionDocument>('Transaction', TransactionSchema);
export default Transaction;

