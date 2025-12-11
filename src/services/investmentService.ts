import Transaction from '../models/transaction';
import UserFinancialProfile from '../models/userFinancialProfile';
import InvestmentOption from '../models/investmentOption';
import dayjs from 'dayjs';

export interface SurplusData {
    income: number;
    expenses: number;
    surplus: number;
    savingsRate: number;
    month: number;
    year: number;
}

export interface InvestmentSuggestion {
    title: string;
    description: string;
    suggestedAmount: number;
    type: string;
    risk: 'low' | 'medium' | 'high';
    expectedReturn: string;
    minAmount: number;
    maxAmount: number;
}

// Calculate monthly surplus
export const calculateSurplus = async (userId: string, month?: number, year?: number): Promise<SurplusData> => {
    const now = dayjs();
    const targetMonth = month || now.month() + 1;
    const targetYear = year || now.year();

    const startDate = dayjs(`${targetYear}-${targetMonth}-01`).startOf('month').toDate();
    const endDate = dayjs(`${targetYear}-${targetMonth}-01`).endOf('month').toDate();

    const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate, $lte: endDate },
    });

    const income = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const surplus = income - expenses;
    const savingsRate = income > 0 ? (surplus / income) * 100 : 0;

    return {
        income,
        expenses,
        surplus,
        savingsRate,
        month: targetMonth,
        year: targetYear,
    };
};

// Determine risk profile based on spending habits
export const determineRiskProfile = async (userId: string): Promise<'low' | 'medium' | 'high'> => {
    const last3Months = [];
    const now = dayjs();

    // Get last 3 months data
    for (let i = 0; i < 3; i++) {
        const month = now.subtract(i, 'month').month() + 1;
        const year = now.subtract(i, 'month').year();
        const surplus = await calculateSurplus(userId, month, year);
        last3Months.push(surplus);
    }

    // Calculate average savings rate
    const avgSavingsRate = last3Months.reduce((sum, m) => sum + m.savingsRate, 0) / 3;

    // Calculate budget adherence (check if expenses are controlled)
    const avgSurplus = last3Months.reduce((sum, m) => sum + m.surplus, 0) / 3;

    // Risk profiling logic
    if (avgSurplus < 0 || avgSavingsRate < 10) {
        return 'low'; // Overspending or low savings
    } else if (avgSavingsRate >= 10 && avgSavingsRate < 30) {
        return 'medium'; // Moderate savings
    } else {
        return 'high'; // High savings, can take more risk
    }
};

// Get investment suggestions based on surplus and risk
export const getInvestmentSuggestions = async (
    surplus: number,
    riskLevel: 'low' | 'medium' | 'high'
): Promise<{ plan: string; suggestions: InvestmentSuggestion[] }> => {
    // Determine surplus tier
    let surplusTier: 'low' | 'medium' | 'high';
    let plan: string;

    if (surplus < 5000) {
        surplusTier = 'low';
        plan = 'Beginner Savings Plan';
    } else if (surplus < 15000) {
        surplusTier = 'medium';
        plan = 'Balanced Growth Plan';
    } else {
        surplusTier = 'high';
        plan = 'Aggressive Growth Plan';
    }

    // Fetch investment options matching criteria
    const options = await InvestmentOption.find({
        surplusTier,
        isActive: true,
    }).sort({ risk: 1 }); // Sort by risk level

    // Filter by risk level and calculate suggested amounts
    const suggestions: InvestmentSuggestion[] = [];

    for (const option of options) {
        // Match risk level
        if (riskLevel === 'low' && option.risk !== 'low') continue;
        if (riskLevel === 'medium' && option.risk === 'high') continue;

        // Calculate suggested amount based on surplus and risk
        let suggestedAmount = 0;

        if (option.risk === 'low') {
            suggestedAmount = Math.min(surplus * 0.6, option.maxAmount);
        } else if (option.risk === 'medium') {
            suggestedAmount = Math.min(surplus * 0.3, option.maxAmount);
        } else {
            suggestedAmount = Math.min(surplus * 0.1, option.maxAmount);
        }

        suggestedAmount = Math.max(suggestedAmount, option.minAmount);

        if (suggestedAmount >= option.minAmount) {
            suggestions.push({
                title: option.title,
                description: option.description,
                suggestedAmount: Math.round(suggestedAmount),
                type: option.type,
                risk: option.risk,
                expectedReturn: option.expectedReturn,
                minAmount: option.minAmount,
                maxAmount: option.maxAmount,
            });
        }
    }

    return { plan, suggestions };
};

// Update user's financial profile
export const updateFinancialProfile = async (userId: string, manualSurplus?: number): Promise<void> => {
    const surplus = await calculateSurplus(userId);
    const riskLevel = await determineRiskProfile(userId);

    // Get or create profile
    let profile = await UserFinancialProfile.findOne({ user: userId });

    if (!profile) {
        profile = new UserFinancialProfile({ user: userId });
    }

    // Update profile
    profile.monthlyIncome = surplus.income;
    profile.monthlyBudget = surplus.expenses;
    profile.avgSavingsRate = surplus.savingsRate;

    // Update surplus history (keep last 6 months)
    profile.surplusHistory.push(surplus.surplus);
    if (profile.surplusHistory.length > 6) {
        profile.surplusHistory.shift();
    }

    if (profile.isAutoRisk) {
        profile.riskLevel = riskLevel;
    }

    if (manualSurplus !== undefined) {
        profile.manualSurplus = manualSurplus;
    }

    profile.lastUpdated = new Date();
    await profile.save();
};

// Get user's financial profile
export const getFinancialProfile = async (userId: string) => {
    let profile = await UserFinancialProfile.findOne({ user: userId });

    if (!profile) {
        // Create default profile
        await updateFinancialProfile(userId);
        profile = await UserFinancialProfile.findOne({ user: userId });
    }

    return profile;
};

// Update risk level manually
export const updateRiskLevel = async (userId: string, riskLevel: 'low' | 'medium' | 'high', isAuto: boolean) => {
    let profile = await UserFinancialProfile.findOne({ user: userId });

    if (!profile) {
        profile = new UserFinancialProfile({ user: userId });
    }

    profile.riskLevel = riskLevel;
    profile.isAutoRisk = isAuto;
    await profile.save();

    return profile;
};
