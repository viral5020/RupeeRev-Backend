import { Schema, model, Document } from 'mongoose';

export type NormalizedCategory = 'index' | 'equity' | 'balanced' | 'gold' | 'debt';

export interface INavHistoryEntry {
  nav: number;
  date: Date;
}

export interface IMutualFundDocument extends Document {
  schemeCode: string;
  name: string;
  nav: number;
  date: Date;
  category: string;
  normalizedCategory: NormalizedCategory;
  oneDayReturn?: number;
  oneMonthReturn?: number;
  threeMonthReturn?: number;
  oneYearReturn?: number;
  navHistory: INavHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const NavHistorySchema = new Schema<INavHistoryEntry>(
  {
    nav: { type: Number, required: true },
    date: { type: Date, required: true },
  },
  { _id: false }
);

const MutualFundSchema = new Schema<IMutualFundDocument>(
  {
    schemeCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    nav: { type: Number, required: true },
    date: { type: Date, required: true },
    category: { type: String, default: 'Uncategorized' },
    normalizedCategory: {
      type: String,
      enum: ['index', 'equity', 'balanced', 'gold', 'debt'],
      required: true,
      default: 'equity',
      index: true,
    },
    oneDayReturn: Number,
    oneMonthReturn: Number,
    threeMonthReturn: Number,
    oneYearReturn: Number,
    navHistory: { type: [NavHistorySchema], default: [] },
  },
  { timestamps: true }
);

export const MutualFund = model<IMutualFundDocument>('MutualFund', MutualFundSchema);
export default MutualFund;


