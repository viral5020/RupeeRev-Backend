import SalaryPlan from '../models/salaryPlan';
import UserFinancialProfile from '../models/userFinancialProfile';

interface AllocationPercentages {
    essentials: number;
    lifestyle: number;
    investments: number;
    emergencyFund: number;
    miscellaneous: number;
}

const DEFAULT_PERCENTAGES: AllocationPercentages = {
    essentials: 50,
    lifestyle: 20,
    investments: 25,
    emergencyFund: 10,
    miscellaneous: 5
};

const LOW_SALARY_PERCENTAGES: AllocationPercentages = {
    essentials: 60,
    lifestyle: 15,
    investments: 15,
    emergencyFund: 5,
    miscellaneous: 5
};

export const calculateAllocation = (salary: number, customPercentages?: Partial<AllocationPercentages>) => {
    // Determine base percentages
    let percentages: AllocationPercentages;

    if (customPercentages) {
        percentages = { ...DEFAULT_PERCENTAGES, ...customPercentages };
    } else if (salary < 20000) {
        percentages = LOW_SALARY_PERCENTAGES;
    } else {
        percentages = DEFAULT_PERCENTAGES;
    }

    // Calculate amounts
    const allocations = {
        essentials: {
            percentage: percentages.essentials,
            amount: Math.round((salary * percentages.essentials) / 100)
        },
        lifestyle: {
            percentage: percentages.lifestyle,
            amount: Math.round((salary * percentages.lifestyle) / 100)
        },
        investments: {
            percentage: percentages.investments,
            amount: Math.round((salary * percentages.investments) / 100)
        },
        emergencyFund: {
            percentage: percentages.emergencyFund,
            amount: Math.round((salary * percentages.emergencyFund) / 100)
        },
        miscellaneous: {
            percentage: percentages.miscellaneous,
            amount: Math.round((salary * percentages.miscellaneous) / 100)
        }
    };

    return allocations;
};

export const generateInvestmentBreakdown = (investmentAmount: number) => {
    // 60% Equity SIP, 30% Hybrid/Gold, 10% Short-term
    return {
        equitySIP: {
            percentage: 60,
            amount: Math.round((investmentAmount * 60) / 100),
            expectedReturn: '12-15%'
        },
        hybridGoldSIP: {
            percentage: 30,
            amount: Math.round((investmentAmount * 30) / 100),
            expectedReturn: '8-10%'
        },
        shortTermSavings: {
            percentage: 10,
            amount: Math.round((investmentAmount * 10) / 100),
            expectedReturn: '4-6%'
        }
    };
};

export const generateInsights = async (
    userId: string,
    salary: number,
    allocations: any
): Promise<string[]> => {
    const insights: string[] = [];

    // Low investment warning
    if (allocations.investments.percentage < 20) {
        insights.push('⚠️ Your investment allocation is below 20%. Consider increasing investments for better wealth building.');
    }

    // Low salary adjustment
    if (salary < 20000) {
        insights.push('💡 Your salary is below ₹20,000. We\'ve adjusted allocations to prioritize essentials (60%).');
    }

    // High essentials warning
    if (allocations.essentials.percentage > 60) {
        insights.push('💰 Your essentials are over 60% of salary. Look for ways to reduce fixed costs.');
    }

    // Emergency fund check
    const profile = await UserFinancialProfile.findOne({ user: userId });
    if (profile) {
        const emergencyFundTarget = salary * 6; // 6 months of salary
        const currentSavings = profile.monthlyIncome * 3; // Approximate

        if (currentSavings >= emergencyFundTarget) {
            insights.push('✅ Emergency fund target achieved! Consider redirecting emergency fund allocation to investments.');
        } else {
            const monthsToTarget = Math.ceil((emergencyFundTarget - currentSavings) / allocations.emergencyFund.amount);
            insights.push(`🎯 Emergency fund: ${monthsToTarget} months to reach 6-month target (₹${emergencyFundTarget.toLocaleString('en-IN')})`);
        }
    }

    // Good investment allocation
    if (allocations.investments.percentage >= 25) {
        insights.push('🌟 Great! You\'re allocating 25%+ to investments. This will help build long-term wealth.');
    }

    // Lifestyle spending
    if (allocations.lifestyle.percentage > 25) {
        insights.push('🛍️ Lifestyle spending is high (>25%). Consider if all expenses are necessary.');
    }

    return insights;
};

export const generateSalaryPlan = async (userId: string, salary: number, customPercentages?: Partial<AllocationPercentages>) => {
    const allocations = calculateAllocation(salary, customPercentages);
    const investmentBreakdown = generateInvestmentBreakdown(allocations.investments.amount);
    const insights = await generateInsights(userId, salary, allocations);

    // Create or update plan
    const plan = await SalaryPlan.findOneAndUpdate(
        { user: userId },
        {
            monthlySalary: salary,
            allocations,
            investmentBreakdown,
            isCustom: !!customPercentages,
            insights
        },
        { upsert: true, new: true }
    );

    return plan;
};

export const getUserSalaryPlan = async (userId: string) => {
    return await SalaryPlan.findOne({ user: userId });
};

export const updateSalaryPlan = async (
    userId: string,
    salary: number,
    customPercentages: Partial<AllocationPercentages>
) => {
    return await generateSalaryPlan(userId, salary, customPercentages);
};
