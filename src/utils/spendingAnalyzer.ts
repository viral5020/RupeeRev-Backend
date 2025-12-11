import Transaction from '../models/transaction';
import dayjs from 'dayjs';

export interface SpendingPatterns {
    totalSpending: number;
    totalIncome: number;
    netSavings: number;
    savingsRate: number;
    categoryBreakdown: Map<string, CategorySpending>;
    topCategories: CategorySpending[];
    topMerchants: string[];
    monthlyTrend: MonthlyData[];
    unusualSpikes: SpikeAlert[];
    recurringBills: RecurringBill[];
    smallFrequentPurchases: FrequentPurchase[];
    largeOneTimeExpenses: LargeExpense[];
}

export interface CategorySpending {
    category: string;
    total: number;
    count: number;
    average: number;
    percentOfTotal: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
}

export interface MonthlyData {
    month: string;
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
}

export interface SpikeAlert {
    category: string;
    currentMonth: number;
    previousMonth: number;
    increasePercent: number;
    severity: 'high' | 'medium' | 'low';
}

export interface RecurringBill {
    merchant: string;
    category: string;
    averageAmount: number;
    frequency: number; // days between payments
    lastPaid: Date;
    nextExpected: Date;
    confidence: number;
}

export interface FrequentPurchase {
    merchant: string;
    category: string;
    count: number;
    totalAmount: number;
    averageAmount: number;
    frequency: string; // e.g., "3 times per week"
}

export interface LargeExpense {
    merchant: string;
    category: string;
    amount: number;
    date: Date;
    percentOfMonthlyIncome: number;
}

/**
 * Analyze spending patterns from transactions (Layer 3)
 */
export const analyzeSpendingPatterns = (
    transactions: any[]
): SpendingPatterns => {
    // Calculate totals
    const totalIncome = transactions
        .filter(t => t.type === 'credit' || t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalSpending = transactions
        .filter(t => t.type === 'debit' || t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const netSavings = totalIncome - totalSpending;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Category breakdown
    const categoryBreakdown = calculateCategoryBreakdown(transactions, totalSpending);

    // Top categories
    const topCategories = Array.from(categoryBreakdown.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    // Top Merchants
    const merchantTotals = new Map<string, number>();
    transactions.forEach(t => {
        if (t.type === 'debit' || t.type === 'expense') {
            const merchant = t.description || t.title || 'Unknown';
            merchantTotals.set(merchant, (merchantTotals.get(merchant) || 0) + t.amount);
        }
    });
    const topMerchants = Array.from(merchantTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([merchant]) => merchant);

    // Monthly trend
    const monthlyTrend = calculateMonthlyTrend(transactions);

    // Unusual spikes
    const unusualSpikes = detectSpikes(transactions);

    // Recurring bills
    const recurringBills = detectRecurringBills(transactions);

    // Small frequent purchases
    const smallFrequentPurchases = detectFrequentPurchases(transactions);

    // Large one-time expenses
    const largeOneTimeExpenses = detectLargeExpenses(transactions, totalIncome);

    return {
        totalSpending,
        totalIncome,
        netSavings,
        savingsRate,
        categoryBreakdown,
        topCategories,
        topMerchants,
        monthlyTrend,
        unusualSpikes,
        recurringBills,
        smallFrequentPurchases,
        largeOneTimeExpenses
    };
};

/**
 * Calculate category-wise breakdown with trends
 */
const calculateCategoryBreakdown = (
    transactions: any[],
    totalSpending: number
): Map<string, CategorySpending> => {
    const now = dayjs();
    const currentMonthStart = now.startOf('month').toDate();
    const lastMonthStart = now.subtract(1, 'month').startOf('month').toDate();
    const lastMonthEnd = now.subtract(1, 'month').endOf('month').toDate();

    const categoryMap = new Map<string, CategorySpending>();
    const currentMonthMap = new Map<string, number>();
    const lastMonthMap = new Map<string, number>();

    transactions.forEach(t => {
        if (t.type !== 'expense') return;

        const category = t.category || 'Uncategorized';
        const amount = t.amount;
        const date = new Date(t.date);

        // Overall totals
        if (!categoryMap.has(category)) {
            categoryMap.set(category, {
                category,
                total: 0,
                count: 0,
                average: 0,
                percentOfTotal: 0,
                trend: 'stable',
                changePercent: 0
            });
        }

        const catData = categoryMap.get(category)!;
        catData.total += amount;
        catData.count += 1;

        // Current month
        if (date >= currentMonthStart) {
            currentMonthMap.set(category, (currentMonthMap.get(category) || 0) + amount);
        }

        // Last month
        if (date >= lastMonthStart && date <= lastMonthEnd) {
            lastMonthMap.set(category, (lastMonthMap.get(category) || 0) + amount);
        }
    });

    // Calculate averages, percentages, and trends
    categoryMap.forEach((data, category) => {
        data.average = data.total / data.count;
        data.percentOfTotal = totalSpending > 0 ? (data.total / totalSpending) * 100 : 0;

        const currentMonth = currentMonthMap.get(category) || 0;
        const lastMonth = lastMonthMap.get(category) || 0;

        if (lastMonth > 0) {
            data.changePercent = ((currentMonth - lastMonth) / lastMonth) * 100;

            if (data.changePercent > 10) {
                data.trend = 'increasing';
            } else if (data.changePercent < -10) {
                data.trend = 'decreasing';
            } else {
                data.trend = 'stable';
            }
        }
    });

    return categoryMap;
};

/**
 * Calculate monthly trend
 */
const calculateMonthlyTrend = (transactions: any[]): MonthlyData[] => {
    const monthlyMap = new Map<string, MonthlyData>();

    transactions.forEach(t => {
        const monthKey = dayjs(t.date).format('YYYY-MM');

        if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, {
                month: monthKey,
                income: 0,
                expenses: 0,
                savings: 0,
                savingsRate: 0
            });
        }

        const data = monthlyMap.get(monthKey)!;

        if (t.type === 'income') {
            data.income += t.amount;
        } else {
            data.expenses += t.amount;
        }
    });

    // Calculate savings
    monthlyMap.forEach(data => {
        data.savings = data.income - data.expenses;
        data.savingsRate = data.income > 0 ? (data.savings / data.income) * 100 : 0;
    });

    return Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
};

/**
 * Detect unusual spending spikes
 */
const detectSpikes = (transactions: any[]): SpikeAlert[] => {
    const now = dayjs();
    const currentMonthStart = now.startOf('month').toDate();
    const lastMonthStart = now.subtract(1, 'month').startOf('month').toDate();
    const lastMonthEnd = now.subtract(1, 'month').endOf('month').toDate();

    const currentMonth = new Map<string, number>();
    const lastMonth = new Map<string, number>();

    transactions.forEach(t => {
        if (t.type !== 'expense') return;

        const category = t.category || 'Uncategorized';
        const date = new Date(t.date);

        if (date >= currentMonthStart) {
            currentMonth.set(category, (currentMonth.get(category) || 0) + t.amount);
        } else if (date >= lastMonthStart && date <= lastMonthEnd) {
            lastMonth.set(category, (lastMonth.get(category) || 0) + t.amount);
        }
    });

    const spikes: SpikeAlert[] = [];

    currentMonth.forEach((current, category) => {
        const previous = lastMonth.get(category) || 0;

        if (previous > 0) {
            const increasePercent = ((current - previous) / previous) * 100;

            if (increasePercent > 30) {
                spikes.push({
                    category,
                    currentMonth: current,
                    previousMonth: previous,
                    increasePercent: Math.round(increasePercent),
                    severity: increasePercent > 100 ? 'high' : increasePercent > 50 ? 'medium' : 'low'
                });
            }
        }
    });

    return spikes.sort((a, b) => b.increasePercent - a.increasePercent);
};

/**
 * Detect recurring bills
 */
const detectRecurringBills = (transactions: any[]): RecurringBill[] => {
    const merchantMap = new Map<string, any[]>();

    // Group by merchant
    transactions.forEach(t => {
        if (t.type !== 'expense') return;

        const merchant = t.title?.trim();
        if (!merchant) return;

        if (!merchantMap.has(merchant)) {
            merchantMap.set(merchant, []);
        }
        merchantMap.get(merchant)!.push(t);
    });

    const recurringBills: RecurringBill[] = [];

    merchantMap.forEach((txns, merchant) => {
        if (txns.length < 2) return;

        // Sort by date
        txns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate average interval
        let totalDays = 0;
        let intervals = 0;

        for (let i = 1; i < txns.length; i++) {
            const days = dayjs(txns[i].date).diff(dayjs(txns[i - 1].date), 'day');
            if (days >= 20 && days <= 40) { // Monthly pattern
                totalDays += days;
                intervals++;
            }
        }

        if (intervals >= 1) {
            const avgFrequency = Math.round(totalDays / intervals);
            const avgAmount = txns.reduce((sum, t) => sum + t.amount, 0) / txns.length;
            const lastPaid = new Date(txns[txns.length - 1].date);
            const nextExpected = dayjs(lastPaid).add(avgFrequency, 'day').toDate();

            recurringBills.push({
                merchant,
                category: txns[0].category || 'Uncategorized',
                averageAmount: Math.round(avgAmount),
                frequency: avgFrequency,
                lastPaid,
                nextExpected,
                confidence: Math.min(0.95, 0.7 + (intervals * 0.1))
            });
        }
    });

    return recurringBills.sort((a, b) => a.nextExpected.getTime() - b.nextExpected.getTime());
};

/**
 * Detect small frequent purchases
 */
const detectFrequentPurchases = (transactions: any[]): FrequentPurchase[] => {
    const merchantMap = new Map<string, any[]>();

    transactions.forEach(t => {
        if (t.type !== 'expense') return;
        if (t.amount > 500) return; // Only small purchases

        const merchant = t.title?.trim();
        if (!merchant) return;

        if (!merchantMap.has(merchant)) {
            merchantMap.set(merchant, []);
        }
        merchantMap.get(merchant)!.push(t);
    });

    const frequentPurchases: FrequentPurchase[] = [];

    merchantMap.forEach((txns, merchant) => {
        if (txns.length < 5) return; // At least 5 purchases

        const totalAmount = txns.reduce((sum, t) => sum + t.amount, 0);
        const avgAmount = totalAmount / txns.length;
        const daysSpan = dayjs(txns[txns.length - 1].date).diff(dayjs(txns[0].date), 'day');
        const frequency = daysSpan > 0 ? `${Math.round(txns.length / (daysSpan / 7))} times per week` : 'frequent';

        frequentPurchases.push({
            merchant,
            category: txns[0].category || 'Uncategorized',
            count: txns.length,
            totalAmount: Math.round(totalAmount),
            averageAmount: Math.round(avgAmount),
            frequency
        });
    });

    return frequentPurchases.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10);
};

/**
 * Detect large one-time expenses
 */
const detectLargeExpenses = (transactions: any[], totalIncome: number): LargeExpense[] => {
    const monthlyIncome = totalIncome / 3; // Approximate monthly income
    const threshold = monthlyIncome * 0.1; // 10% of monthly income

    const largeExpenses: LargeExpense[] = [];

    transactions.forEach(t => {
        if (t.type !== 'expense') return;
        if (t.amount < threshold) return;

        const percentOfMonthlyIncome = monthlyIncome > 0 ? (t.amount / monthlyIncome) * 100 : 0;

        largeExpenses.push({
            merchant: t.title,
            category: t.category || 'Uncategorized',
            amount: t.amount,
            date: new Date(t.date),
            percentOfMonthlyIncome: Math.round(percentOfMonthlyIncome)
        });
    });

    return largeExpenses.sort((a, b) => b.amount - a.amount).slice(0, 10);
};
