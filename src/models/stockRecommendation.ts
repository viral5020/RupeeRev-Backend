import { Schema, model, Document } from 'mongoose';

export interface IStockRecommendation extends Document {
    symbol: string;
    name: string;
    sector: string;
    marketCap: 'large' | 'mid' | 'small';
    currentPrice: number;
    targetPrice: number;
    upside: number;
    investmentHorizon: '1-3 years' | '3-5 years' | '5+ years';
    riskLevel: 'low' | 'medium' | 'high';
    rationale: string;
    keyStrengths: string[];
    risks: string[];
    dividendYield?: number;
    peRatio?: number;
    recommendedAllocation: number; // percentage of equity portfolio
    isActive: boolean;
    lastUpdated: Date;
}

const StockRecommendationSchema = new Schema<IStockRecommendation>(
    {
        symbol: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        sector: { type: String, required: true },
        marketCap: { type: String, enum: ['large', 'mid', 'small'], required: true },
        currentPrice: { type: Number, required: true },
        targetPrice: { type: Number, required: true },
        upside: { type: Number, required: true },
        investmentHorizon: { type: String, enum: ['1-3 years', '3-5 years', '5+ years'], required: true },
        riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
        rationale: { type: String, required: true },
        keyStrengths: { type: [String], required: true },
        risks: { type: [String], required: true },
        dividendYield: { type: Number },
        peRatio: { type: Number },
        recommendedAllocation: { type: Number, required: true },
        isActive: { type: Boolean, default: true },
        lastUpdated: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export const StockRecommendation = model<IStockRecommendation>('StockRecommendation', StockRecommendationSchema);
export default StockRecommendation;
