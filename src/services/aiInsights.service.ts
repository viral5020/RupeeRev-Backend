import Transaction from '../models/transaction';
import UserInsights from '../models/UserInsights';
import { analyzeSpendingPatterns, SpendingPatterns } from '../utils/spendingAnalyzer';
import { cleanTransaction, categorizeTransaction } from '../utils/categorizationUtils';
import logger from '../utils/logger';
import axios from 'axios';
import dayjs from 'dayjs';
import Category from '../models/category';
import mongoose from 'mongoose';

const API_KEY = process.env.VITE_LLM_API_KEY;
const API_ENDPOINT = process.env.VITE_LLM_API_ENDPOINT ||
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

export interface AiInsightsResponse {
    insights: string[];
    predictedExpenses: Array<{
        category: string;
        amount: number;
        predictedDate: Date;
        confidence: number;
    }>;
    savingTips: string[];
    riskySpending: string[];
    monthlySavingTarget: number;
    investmentSuggestion: number;
    explanation: string;
}

/**
 * Get spending patterns only (without AI insights)
 */
export const getSpendingPatterns = async (userId: string): Promise<SpendingPatterns> => {
    // 1. Fetch raw transactions
    const queryDate = dayjs().subtract(30, 'day').toDate();
    const rawTransactions = await Transaction.find({
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: queryDate }
    }).sort({ date: -1 }).populate('category');

    // 2. Layer 1 & 2: Clean and Categorize
    const processedTransactions = rawTransactions.map(t => {
        const cleaned = cleanTransaction(t.toObject());

        // Apply categorization if missing or generic
        if (!cleaned.category || cleaned.category === 'Uncategorized' || cleaned.category === 'Others') {
            cleaned.category = categorizeTransaction(cleaned.description);
        }
        // Ensure category is a string
        if (typeof cleaned.category === 'object') {
            cleaned.category = (cleaned.category as any).name || 'Others';
        }

        return cleaned;
    });

    // 3. Layer 3: Analyze Spending Patterns
    return analyzeSpendingPatterns(processedTransactions);
};

/**
 * Generate comprehensive AI insights for a user
 */
export const generateAiInsights = async (userId: string, forceRefresh: boolean = false): Promise<any> => {
    try {
        logger.info(`Generating AI insights for user ${userId}`);

        // Check cache
        if (!forceRefresh) {
            const recentInsights = await UserInsights.findOne({
                user: userId,
                generatedAt: { $gte: dayjs().subtract(24, 'hour').toDate() }
            }).sort({ generatedAt: -1 });

            if (recentInsights) {
                logger.info('Returning cached insights');
                return recentInsights;
            }
        }

        // 1. Fetch raw transactions
        const queryDate = dayjs().subtract(30, 'day').toDate();
        logger.info(`[AI Insights] Fetching txns for user ${userId} since ${queryDate.toISOString()}`);

        const rawTransactions = await Transaction.find({
            user: new mongoose.Types.ObjectId(userId),
            date: { $gte: queryDate }
        }).sort({ date: -1 }).populate('category');

        logger.info(`[AI Insights] Found ${rawTransactions.length} raw transactions`);

        // Fetch all categories for ID->Name mapping
        const allCategories = await Category.find({});
        const categoryMap = new Map(allCategories.map(c => [c._id.toString(), c.name]));

        // 2. Layer 1 & 2: Clean and Categorize
        const processedTransactions = rawTransactions.map(t => {
            const cleaned = cleanTransaction(t.toObject());

            // Apply categorization if missing or generic
            if (!cleaned.category || cleaned.category === 'Uncategorized' || cleaned.category === 'Others') {
                cleaned.category = categorizeTransaction(cleaned.description);
            }

            // Resolve Category ID to Name
            // If it's an object (populated), use name. If it's a string (ID), look it up.
            if (typeof cleaned.category === 'object' && (cleaned.category as any).name) {
                cleaned.category = (cleaned.category as any).name;
            } else if (typeof cleaned.category === 'string') {
                // Check if it's an ID
                if (categoryMap.has(cleaned.category)) {
                    cleaned.category = categoryMap.get(cleaned.category) || 'Others';
                }
            }

            return cleaned;
        });

        // 3. Layer 3: Analyze Spending Patterns
        const patterns = analyzeSpendingPatterns(processedTransactions);

        // Generate AI insights using Gemini
        const aiResponse = await callGeminiForInsights(patterns, processedTransactions);

        // Generate rule-based predictions
        const rulePredictions = generateRuleBasedPredictions(patterns);

        // Combine AI and rule-based predictions
        const combinedPredictions = combinePredictions(aiResponse.predictedExpenses, rulePredictions);

        // Generate saving recommendations
        const recommendations = generateSavingRecommendations(patterns, aiResponse);

        // Save insights to database
        const userInsights = new UserInsights({
            user: userId,
            generatedAt: new Date(),
            period: {
                start: dayjs().subtract(90, 'day').toDate(),
                end: new Date()
            },
            insights: aiResponse.insights,
            predictedExpenses: combinedPredictions,
            savingTips: aiResponse.savingTips,
            riskySpending: aiResponse.riskySpending,
            spendingPatterns: {
                totalSpending: patterns.totalSpending,
                totalIncome: patterns.totalIncome,
                netSavings: patterns.netSavings,
                savingsRate: patterns.savingsRate,
                categoryBreakdown: patterns.categoryBreakdown,
                topCategories: patterns.topCategories.map(c => c.category),
                unusualSpikes: patterns.unusualSpikes.map(s =>
                    `${s.category}: +${s.increasePercent}% (₹${s.currentMonth})`
                ),
                recurringBills: patterns.recurringBills.map(b =>
                    `${b.merchant}: ₹${b.averageAmount} every ${b.frequency} days`
                )
            },
            recommendations,
            geminiResponse: aiResponse
        });

        await userInsights.save();
        logger.info('AI insights generated and saved successfully');

        return userInsights;
    } catch (error) {
        logger.error('Failed to generate AI insights', error);
        throw error;
    }
};

/**
 * Call Gemini API for AI-powered insights
 */
const callGeminiForInsights = async (
    patterns: SpendingPatterns,
    transactions: any[]
): Promise<AiInsightsResponse> => {
    if (!API_KEY) {
        logger.warn('VITE_LLM_API_KEY not set, returning default insights');
        return getDefaultInsights(patterns);
    }

    try {
        // Separate recurring transactions
        const recurringIncome = transactions.filter(t => t.isRecurring && t.type === 'income');
        const recurringExpenses = transactions.filter(t => t.isRecurring && t.type === 'expense');

        // Calculate monthly recurring income
        const monthlyRecurringIncome = recurringIncome.reduce((sum, t) => {
            const multiplier = t.recurrence?.frequency === 'monthly' ? 1 :
                t.recurrence?.frequency === 'yearly' ? 1 / 12 :
                    t.recurrence?.frequency === 'weekly' ? 4 :
                        t.recurrence?.frequency === 'daily' ? 30 : 1;
            return sum + (t.amount * multiplier);
        }, 0);

        // Calculate monthly recurring expenses
        const monthlyRecurringExpenses = recurringExpenses.reduce((sum, t) => {
            const multiplier = t.recurrence?.frequency === 'monthly' ? 1 :
                t.recurrence?.frequency === 'yearly' ? 1 / 12 :
                    t.recurrence?.frequency === 'weekly' ? 4 :
                        t.recurrence?.frequency === 'daily' ? 30 : 1;
            return sum + (t.amount * multiplier);
        }, 0);

        // Prepare data for Gemini
        const transactionSummary = transactions.slice(0, 50).map(t => ({
            title: t.title,
            amount: t.amount,
            type: t.type,
            category: t.category || 'Others',
            date: dayjs(t.date).format('YYYY-MM-DD')
        }));

        const prompt = `
You are an expert financial advisor analyzing a user's spending behavior in India.

USER DATA (Last 90 days):
- Total Income: ₹${patterns.totalIncome.toFixed(2)}
- Total Spending: ₹${patterns.totalSpending.toFixed(2)}
- Net Savings: ₹${patterns.netSavings.toFixed(2)}
- Savings Rate: ${patterns.savingsRate.toFixed(1)}%

RECURRING INCOME (User-marked, Monthly Equivalent):
${recurringIncome.length > 0 ? recurringIncome.map(t =>
            `- ${t.title}: ₹${t.amount} (${t.recurrence?.frequency || 'monthly'})`
        ).join('\n') : 'None marked by user'}
Monthly Recurring Income Total: ₹${monthlyRecurringIncome.toFixed(2)}

RECURRING EXPENSES (User-marked, Monthly Equivalent):
${recurringExpenses.length > 0 ? recurringExpenses.map(t =>
            `- ${t.title}: ₹${t.amount} (${t.recurrence?.frequency || 'monthly'})`
        ).join('\n') : 'None marked by user'}
Monthly Recurring Expenses Total: ₹${monthlyRecurringExpenses.toFixed(2)}

TOP SPENDING CATEGORIES:
${patterns.topCategories.slice(0, 5).map(c =>
            `- ${c.category}: ₹${c.total.toFixed(2)} (${c.count} transactions, ${c.trend})`
        ).join('\n')}

TOP MERCHANTS:
${patterns.topMerchants.slice(0, 5).join(', ')}

UNUSUAL SPIKES:
${patterns.unusualSpikes.map(s =>
            `- ${s.category}: +${s.increasePercent}% increase (₹${s.previousMonth} → ₹${s.currentMonth})`
        ).join('\n') || 'None detected'}

RECURRING BILLS:
${patterns.recurringBills.slice(0, 5).map(b =>
            `- ${b.merchant}: ₹${b.averageAmount} every ${b.frequency} days`
        ).join('\n') || 'None detected'}

RECENT TRANSACTIONS (Sample):
${transactionSummary.slice(0, 20).map(t =>
            `- ${t.date}: ${t.title} (${t.category}) - ₹${t.amount}`
        ).join('\n')}

IMPORTANT INSTRUCTIONS:
1. When calculating monthly income, PRIORITIZE user-marked recurring income (₹${monthlyRecurringIncome.toFixed(2)}) over detected patterns. This is more accurate.
2. Consider user-marked recurring expenses (₹${monthlyRecurringExpenses.toFixed(2)}) as fixed monthly obligations.
3. In your explanation, mention that you factored in recurring transactions for better accuracy.

TASK:
Generate a comprehensive financial analysis with:
1. Top 10 personalized insights about spending habits (be specific, use actual numbers and categories)
2. Predicted upcoming expenses for next 30 days (category, amount, date, confidence 0-1)
3. 7-10 actionable money-saving tips (specific to this user's spending patterns)
4. 5-7 risky spending patterns to watch (specific warnings based on data)
5. Monthly saving target recommendation (realistic based on income and expenses)
6. Investment suggestion based on surplus (if any)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "insights": ["insight1 with specific numbers", "insight2", ...],
  "predictedExpenses": [
    {"category": "Electricity", "amount": 1500, "date": "2025-01-05", "confidence": 0.9}
  ],
  "savingTips": ["specific tip 1", "tip 2", ...],
  "riskySpending": ["specific risk 1", "risk 2", ...],
  "monthlySavingTarget": 5000,
  "investmentSuggestion": 3000,
  "explanation": "Brief 2-3 sentence summary mentioning that recurring transactions were considered for accuracy"
}
`;

        const response = await axios.post(
            `${API_ENDPOINT}?key=${API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 65536,
                    topP: 0.8,
                    topK: 40
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            logger.warn('Empty response from Gemini');
            return getDefaultInsights(patterns);
        }

        // Clean and parse JSON
        let cleanJson = text.trim();
        cleanJson = cleanJson.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        cleanJson = cleanJson.replace(/^[^{]*/, '').replace(/[^}]*$/, '');

        const parsed = JSON.parse(cleanJson);

        // Convert date strings to Date objects
        if (parsed.predictedExpenses) {
            parsed.predictedExpenses = parsed.predictedExpenses.map((exp: any) => ({
                ...exp,
                predictedDate: new Date(exp.date || exp.predictedDate),
                confidence: exp.confidence || 0.7
            }));
        }

        return {
            insights: parsed.insights || [],
            predictedExpenses: parsed.predictedExpenses || [],
            savingTips: parsed.savingTips || [],
            riskySpending: parsed.riskySpending || [],
            monthlySavingTarget: parsed.monthlySavingTarget || 0,
            investmentSuggestion: parsed.investmentSuggestion || 0,
            explanation: parsed.explanation || ''
        };

    } catch (error: any) {
        logger.error('Gemini API call failed', { error: error.message });
        return getDefaultInsights(patterns);
    }
};

/**
 * Generate rule-based predictions for recurring expenses
 */
const generateRuleBasedPredictions = (patterns: SpendingPatterns): any[] => {
    const predictions: any[] = [];

    // Predict from recurring bills
    patterns.recurringBills.forEach(bill => {
        if (dayjs(bill.nextExpected).diff(dayjs(), 'day') <= 30) {
            predictions.push({
                category: bill.category,
                amount: bill.averageAmount,
                predictedDate: bill.nextExpected,
                confidence: bill.confidence,
                source: 'recurring'
            });
        }
    });

    // Predict average spending for top categories
    const nextMonth = dayjs().add(1, 'month');
    patterns.topCategories.slice(0, 3).forEach(cat => {
        if (!predictions.find(p => p.category === cat.category)) {
            predictions.push({
                category: cat.category,
                amount: Math.round(cat.average * 4), // Approximate monthly
                predictedDate: nextMonth.endOf('month').toDate(),
                confidence: 0.6,
                source: 'average'
            });
        }
    });

    return predictions;
};

/**
 * Combine AI and rule-based predictions
 */
const combinePredictions = (aiPredictions: any[], rulePredictions: any[]): any[] => {
    const combined = [...aiPredictions];

    rulePredictions.forEach(rulePred => {
        const existing = combined.find(p => p.category === rulePred.category);
        if (!existing) {
            combined.push(rulePred);
        } else if (rulePred.confidence > existing.confidence) {
            // Replace with higher confidence prediction
            Object.assign(existing, rulePred);
        }
    });

    return combined.sort((a, b) =>
        new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime()
    );
};

/**
 * Generate saving recommendations
 */
const generateSavingRecommendations = (patterns: SpendingPatterns, aiResponse: AiInsightsResponse): any => {
    const monthlyIncome = patterns.totalIncome / 3;
    const monthlyExpense = patterns.totalSpending / 3;
    const surplus = monthlyIncome - monthlyExpense;

    // Calculate targets
    const monthlySavingTarget = aiResponse.monthlySavingTarget || Math.max(0, surplus * 0.7);
    const weeklySavingTarget = Math.round(monthlySavingTarget / 4);
    const emergencyFundTarget = monthlyExpense * 6; // 6 months of expenses
    const investmentSuggestion = aiResponse.investmentSuggestion || Math.max(0, surplus * 0.5);

    // Category limits (20% reduction on top categories)
    const categoryLimits = new Map<string, number>();
    patterns.topCategories.slice(0, 5).forEach(cat => {
        categoryLimits.set(cat.category, Math.round(cat.total * 0.8));
    });

    // Identify unnecessary expenses (small frequent purchases)
    const unnecessaryExpenses = patterns.smallFrequentPurchases
        .slice(0, 5)
        .map(p => `${p.merchant}: Reduce ${p.frequency} purchases (Save ₹${Math.round(p.totalAmount * 0.3)}/month)`);

    return {
        monthlySavingTarget: Math.round(monthlySavingTarget),
        weeklySavingTarget,
        categoryLimits,
        unnecessaryExpenses,
        emergencyFundTarget: Math.round(emergencyFundTarget),
        investmentSuggestion: Math.round(investmentSuggestion)
    };
};

/**
 * Get default insights when Gemini is not available
 */
const getDefaultInsights = (patterns: SpendingPatterns): AiInsightsResponse => {
    const insights: string[] = [
        `Your savings rate is ${patterns.savingsRate.toFixed(1)}%. ${patterns.savingsRate > 20 ? 'Great job!' : 'Try to increase it to at least 20%.'}`,
        `Top spending category: ${patterns.topCategories[0]?.category} (₹${patterns.topCategories[0]?.total.toFixed(2)})`,
    ];

    if (patterns.unusualSpikes.length > 0) {
        insights.push(`Unusual spike detected in ${patterns.unusualSpikes[0].category}: +${patterns.unusualSpikes[0].increasePercent}%`);
    }

    if (patterns.smallFrequentPurchases.length > 0) {
        const top = patterns.smallFrequentPurchases[0];
        insights.push(`You're making frequent small purchases at ${top.merchant} (${top.count} times, ₹${top.totalAmount} total)`);
    }

    return {
        insights,
        predictedExpenses: [],
        savingTips: [
            'Track your daily expenses to identify spending leaks',
            'Set up automatic transfers to a savings account',
            'Review and cancel unused subscriptions'
        ],
        riskySpending: [],
        monthlySavingTarget: Math.max(0, patterns.netSavings / 3),
        investmentSuggestion: 0,
        explanation: 'Basic insights generated without AI'
    };
};

/**
 * Get latest insights for a user
 */
export const getLatestInsights = async (userId: string): Promise<any> => {
    const insights = await UserInsights.findOne({ user: userId })
        .sort({ generatedAt: -1 });

    if (!insights) {
        // Generate new insights if none exist
        return await generateAiInsights(userId);
    }

    return insights;
};
