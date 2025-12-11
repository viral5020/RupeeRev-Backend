import { Schema, model, Document } from 'mongoose';

export interface ISalaryPlan extends Document {
    user: Schema.Types.ObjectId;
    monthlySalary: number;
    allocations: {
        essentials: { percentage: number; amount: number };
        lifestyle: { percentage: number; amount: number };
        investments: { percentage: number; amount: number };
        emergencyFund: { percentage: number; amount: number };
        miscellaneous: { percentage: number; amount: number };
    };
    investmentBreakdown: {
        equitySIP: { percentage: number; amount: number; expectedReturn: string };
        hybridGoldSIP: { percentage: number; amount: number; expectedReturn: string };
        shortTermSavings: { percentage: number; amount: number; expectedReturn: string };
    };
    isCustom: boolean;
    insights: string[];
    createdAt: Date;
    updatedAt: Date;
}

const SalaryPlanSchema = new Schema<ISalaryPlan>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        monthlySalary: { type: Number, required: true },
        allocations: {
            essentials: {
                percentage: { type: Number, required: true },
                amount: { type: Number, required: true }
            },
            lifestyle: {
                percentage: { type: Number, required: true },
                amount: { type: Number, required: true }
            },
            investments: {
                percentage: { type: Number, required: true },
                amount: { type: Number, required: true }
            },
            emergencyFund: {
                percentage: { type: Number, required: true },
                amount: { type: Number, required: true }
            },
            miscellaneous: {
                percentage: { type: Number, required: true },
                amount: { type: Number, required: true }
            }
        },
        investmentBreakdown: {
            equitySIP: {
                percentage: { type: Number, required: true },
                amount: { type: Number, required: true },
                expectedReturn: { type: String, required: true }
            },
            hybridGoldSIP: {
                percentage: { type: Number, required: true },
                amount: { type: Number, required: true },
                expectedReturn: { type: String, required: true }
            },
            shortTermSavings: {
                percentage: { type: Number, required: true },
                amount: { type: Number, required: true },
                expectedReturn: { type: String, required: true }
            }
        },
        isCustom: { type: Boolean, default: false },
        insights: [{ type: String }]
    },
    { timestamps: true }
);

export const SalaryPlan = model<ISalaryPlan>('SalaryPlan', SalaryPlanSchema);
export default SalaryPlan;
