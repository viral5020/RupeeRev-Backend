import mongoose, { Schema, Document } from 'mongoose';

export interface IUserInsights extends Document {
    user: mongoose.Types.ObjectId;
    generatedAt: Date;
    period: {
        start: Date;
        end: Date;
    };
    insights: string[];
    predictedExpenses: Array<{
        category: string;
        amount: number;
        predictedDate: Date;
        confidence: number;
    }>;
    savingTips: string[];
    riskySpending: string[];
    spendingPatterns: {
        totalSpending: number;
        totalIncome: number;
        netSavings: number;
        savingsRate: number;
        categoryBreakdown: Map<string, any>;
        topCategories: string[];
        unusualSpikes: string[];
        recurringBills: string[];
    };
    recommendations: {
        monthlySavingTarget: number;
        weeklySavingTarget: number;
        categoryLimits: Map<string, number>;
        unnecessaryExpenses: string[];
        emergencyFundTarget: number;
        investmentSuggestion: number;
    };
    geminiResponse: any; // Raw Gemini response for debugging
}

const UserInsightsSchema: Schema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        generatedAt: {
            type: Date,
            default: Date.now,
            index: true
        },
        period: {
            start: { type: Date, required: true },
            end: { type: Date, required: true }
        },
        insights: [{ type: String }],
        predictedExpenses: [
            {
                category: { type: String, required: true },
                amount: { type: Number, required: true },
                predictedDate: { type: Date, required: true },
                confidence: { type: Number, min: 0, max: 1 }
            }
        ],
        savingTips: [{ type: String }],
        riskySpending: [{ type: String }],
        spendingPatterns: {
            totalSpending: { type: Number, default: 0 },
            totalIncome: { type: Number, default: 0 },
            netSavings: { type: Number, default: 0 },
            savingsRate: { type: Number, default: 0 },
            categoryBreakdown: { type: Map, of: Schema.Types.Mixed },
            topCategories: [{ type: String }],
            unusualSpikes: [{ type: String }],
            recurringBills: [{ type: String }]
        },
        recommendations: {
            monthlySavingTarget: { type: Number, default: 0 },
            weeklySavingTarget: { type: Number, default: 0 },
            categoryLimits: { type: Map, of: Number },
            unnecessaryExpenses: [{ type: String }],
            emergencyFundTarget: { type: Number, default: 0 },
            investmentSuggestion: { type: Number, default: 0 }
        },
        geminiResponse: { type: Schema.Types.Mixed }
    },
    {
        timestamps: true
    }
);

// Index for efficient queries
UserInsightsSchema.index({ user: 1, generatedAt: -1 });

// Keep only the latest 10 insights per user
UserInsightsSchema.pre('save', async function (next) {
    if (this.isNew) {
        const count = await mongoose.model('UserInsights').countDocuments({ user: this.user });
        if (count >= 10) {
            // Delete oldest insights
            const oldest = await mongoose.model('UserInsights')
                .find({ user: this.user })
                .sort({ generatedAt: 1 })
                .limit(count - 9);

            await mongoose.model('UserInsights').deleteMany({
                _id: { $in: oldest.map(doc => doc._id) }
            });
        }
    }
    next();
});

export default mongoose.model<IUserInsights>('UserInsights', UserInsightsSchema);
