import { Schema, model, Document } from 'mongoose';

export interface IInvestmentOption extends Document {
    title: string;
    description: string;
    type: 'SIP' | 'FD' | 'RD' | 'ETF' | 'GOLD' | 'STOCK' | 'CRYPTO' | 'GOVT_BOND' | 'P2P';
    risk: 'low' | 'medium' | 'high';
    minAmount: number;
    maxAmount: number;
    surplusTier: 'low' | 'medium' | 'high';
    expectedReturn: string;
    liquidity: 'high' | 'medium' | 'low';
    category: string;
    isActive: boolean;
}

const InvestmentOptionSchema = new Schema<IInvestmentOption>(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        type: {
            type: String,
            enum: ['SIP', 'FD', 'RD', 'ETF', 'GOLD', 'STOCK', 'CRYPTO', 'GOVT_BOND', 'P2P'],
            required: true
        },
        risk: { type: String, enum: ['low', 'medium', 'high'], required: true },
        minAmount: { type: Number, required: true },
        maxAmount: { type: Number, required: true },
        surplusTier: { type: String, enum: ['low', 'medium', 'high'], required: true },
        expectedReturn: { type: String, required: true },
        liquidity: { type: String, enum: ['high', 'medium', 'low'], required: true },
        category: { type: String, required: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const InvestmentOption = model<IInvestmentOption>('InvestmentOption', InvestmentOptionSchema);
export default InvestmentOption;
