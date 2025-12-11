import { Schema, model, Document } from 'mongoose';

export interface IUserFinancialProfile extends Document {
    user: Schema.Types.ObjectId;
    riskLevel: 'low' | 'medium' | 'high';
    isAutoRisk: boolean;
    monthlyIncome: number;
    monthlyBudget: number;
    avgSavingsRate: number;
    surplusHistory: number[];
    manualSurplus?: number;
    lastUpdated: Date;
}

const UserFinancialProfileSchema = new Schema<IUserFinancialProfile>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        isAutoRisk: { type: Boolean, default: true },
        monthlyIncome: { type: Number, default: 0 },
        monthlyBudget: { type: Number, default: 0 },
        avgSavingsRate: { type: Number, default: 0 },
        surplusHistory: { type: [Number], default: [] },
        manualSurplus: { type: Number },
        lastUpdated: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export const UserFinancialProfile = model<IUserFinancialProfile>('UserFinancialProfile', UserFinancialProfileSchema);
export default UserFinancialProfile;
