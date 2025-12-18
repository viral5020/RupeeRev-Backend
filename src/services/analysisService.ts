
import axios from 'axios';
import logger from '../utils/logger';
import Transaction from '../models/transaction';
import { getLatestInsights } from './aiInsights.service';

const API_KEY = process.env.VITE_LLM_API_KEY;
const API_ENDPOINT = process.env.VITE_LLM_API_ENDPOINT;

/**
 * Detect recurring transactions and predict upcoming bills
 */
export const predictBills = (transactions: any[]) => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const merchantGroups = new Map<string, any[]>();

    // Group by merchant (simple normalization)
    expenses.forEach(t => {
        const merchant = t.description?.toLowerCase().trim() || 'unknown';
        // Simple fuzzy match or just exact match for now
        const existingKey = Array.from(merchantGroups.keys()).find(k =>
            k.includes(merchant) || merchant.includes(k)
        );
        const key = existingKey || merchant;

        if (!merchantGroups.has(key)) {
            merchantGroups.set(key, []);
        }
        merchantGroups.get(key)?.push(t);
    });

    const predictedBills: any[] = [];
    const currentDate = new Date();

    merchantGroups.forEach((txns, merchant) => {
        if (txns.length < 2) return; // Need at least 2 transactions to establish pattern

        // Sort by date desc
        txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Check for regularity (roughly monthly)
        const dates = txns.map(t => new Date(t.date));
        let isRegular = true;
        let totalDaysDiff = 0;

        for (let i = 0; i < dates.length - 1; i++) {
            const diffDays = (dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays < 20 || diffDays > 40) { // Allow 20-40 days gap for "monthly"
                isRegular = false;
                break;
            }
            totalDaysDiff += diffDays;
        }

        if (isRegular) {
            const avgAmount = txns.reduce((sum, t) => sum + t.amount, 0) / txns.length;
            const lastDate = dates[0];
            const avgGap = totalDaysDiff / (dates.length - 1);

            // Predict next date
            const nextDate = new Date(lastDate.getTime() + (avgGap * 24 * 60 * 60 * 1000));

            // Only include if it's due this month or next 30 days
            const daysUntilDue = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysUntilDue >= -5 && daysUntilDue <= 35) { // Show if due recently or coming up
                predictedBills.push({
                    merchant: txns[0].description, // Use most recent name
                    amount: parseFloat(avgAmount.toFixed(2)),
                    expectedDate: nextDate.toISOString().split('T')[0],
                    confidence: 0.8 + (txns.length * 0.05), // Higher confidence with more history
                    lastPaid: lastDate.toISOString().split('T')[0]
                });
            }
        }
    });

    return predictedBills.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());
};



/**
 * Generate analysis from imported transactions
 */
export const generateAnalysis = async (transactions: any[]) => {
    if (transactions.length === 0) {
        return {
            summary: {
                totalImported: 0,
                dateRange: { start: new Date().toISOString(), end: new Date().toISOString() },
                totalIncome: 0,
                totalExpenses: 0,
                avgMonthlyIncome: 0,
                avgMonthlyExpense: 0,
            },
            categories: [],
            subscriptions: [],
            salaryDetected: null,
            monthlyAverages: [],
            spendingSpikes: [],
            updatedSurplus: 0,
            updatedSavingsRate: 0,
            goalImpact: [],
            predictedBills: [],
            aiInsights: [],
            spendingTwins: undefined
        };
    }

    // Calculate totals (with proper decimal formatting)
    const totalIncome = parseFloat(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0).toFixed(2));
    const totalExpenses = parseFloat(transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0).toFixed(2));

    // Get date range
    const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
    const dateRange = {
        start: dates[0]?.toISOString() || new Date().toISOString(),
        end: dates[dates.length - 1]?.toISOString() || new Date().toISOString(),
    };

    // Calculate monthly averages (rough estimate, with decimal formatting)
    const monthsDiff = Math.max(1, (dates[dates.length - 1]?.getTime() - dates[0]?.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const avgMonthlyIncome = parseFloat((totalIncome / monthsDiff).toFixed(2));
    const avgMonthlyExpense = parseFloat((totalExpenses / monthsDiff).toFixed(2));

    // Group by category
    const categoryMap = new Map<string, { total: number; count: number }>();
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const catName = t.category?.name || 'Uncategorized';
            const existing = categoryMap.get(catName) || { total: 0, count: 0 };
            categoryMap.set(catName, {
                total: parseFloat((existing.total + t.amount).toFixed(2)),
                count: existing.count + 1,
            });
        }
    });

    const categories = Array.from(categoryMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total);

    const analysisBase = {
        summary: {
            totalImported: transactions.length,
            dateRange,
            totalIncome,
            totalExpenses,
            avgMonthlyIncome,
            avgMonthlyExpense,
        },
        categories,
        subscriptions: [],
        salaryDetected: null,
        monthlyAverages: [],
        spendingSpikes: [],
        updatedSurplus: parseFloat((avgMonthlyIncome - avgMonthlyExpense).toFixed(2)),
        updatedSavingsRate: parseFloat((avgMonthlyIncome > 0 ? ((avgMonthlyIncome - avgMonthlyExpense) / avgMonthlyIncome) * 100 : 0).toFixed(2)),
        goalImpact: [],
    };

    // Calculate predicted bills
    const predictedBills = predictBills(transactions);

    // Generate AI Insights using the shared robust service
    // We use the first transaction's user ID to fetch insights.
    let aiInsights: any[] = [];
    let extraAiData: any = {};

    try {
        if (transactions.length > 0) {
            const userId = transactions[0].user.toString();
            // Force refresh to ensure it captures these new transactions? 
            // The user just imported them, so we probably want a refresh.
            // But getLatestInsights checks cache. aiInsights.service generateAiInsights does raw fetch.
            // Let's call generateAiInsights directly to force new insights for this batch?
            // No, getLatestInsights generates if missing. 
            // Ideally we should force refresh because we just added data.
            // But for now let's just use what's available or generate new.
            const aiData = await getLatestInsights(userId);

            if (aiData) {
                // Map string insights to object format expected by PDF template (legacy support)
                // The new template is updated to render tips/risks separately.
                if (aiData.insights && Array.isArray(aiData.insights)) {
                    aiInsights = aiData.insights.map((str: string) => ({
                        type: 'info',
                        title: 'Financial Insight',
                        message: str
                    }));
                }

                extraAiData = {
                    predictedExpenses: aiData.predictedExpenses,
                    savingTips: aiData.savingTips,
                    riskySpending: aiData.riskySpending,
                    considerReducing: aiData.recommendations?.unnecessaryExpenses || []
                };
            }
        }
    } catch (err) {
        logger.error('Error fetching shared AI insights in generateAnalysis', err);
    }

    // Calculate Spending Twins Data
    const currentExpenses = analysisBase.summary.totalExpenses;
    const currentSurplus = analysisBase.updatedSurplus;
    // Income derived from Surplus + Expenses to ensure consistency
    // (Surplus = Income - Expense) -> Income = Surplus + Expense
    const currentIncome = currentSurplus + currentExpenses;

    // Good You: Reduces expenses by 10%
    const goodExpenses = currentExpenses * 0.9;
    const goodSurplus = currentIncome - goodExpenses;

    // Bad You: Increases expenses by 10%
    const badExpenses = currentExpenses * 1.1;
    const badSurplus = currentIncome - badExpenses;

    const spendingTwins = {
        goodYou: {
            expenses: goodExpenses,
            surplus: goodSurplus,
            netWorth1Y: goodSurplus * 12,
            netWorth3Y: goodSurplus * 36,
            netWorth5Y: goodSurplus * 60
        },
        currentYou: {
            expenses: currentExpenses,
            surplus: currentSurplus,
            netWorth1Y: currentSurplus * 12,
            netWorth3Y: currentSurplus * 36,
            netWorth5Y: currentSurplus * 60
        },
        badYou: {
            expenses: badExpenses,
            surplus: badSurplus,
            netWorth1Y: badSurplus * 12,
            netWorth3Y: badSurplus * 36,
            netWorth5Y: badSurplus * 60
        }
    };

    return {
        ...analysisBase,
        predictedBills,
        aiInsights,
        spendingTwins,
        ...extraAiData
    };
};
