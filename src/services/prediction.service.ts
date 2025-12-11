import Transaction from '../models/transaction';
import dayjs from 'dayjs';
import logger from '../utils/logger';
import axios from 'axios';

const API_ENDPOINT = process.env.VITE_LLM_API_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const API_KEY = process.env.VITE_LLM_API_KEY;

export interface AIPrediction {
  predictedAmount: number;
  reasoning: string;
  confidence: number;
}

// ... existing interfaces ...

export const predictMonthlyExpenseAI = async (userId: string): Promise<AIPrediction | null> => {
  if (!API_KEY) {
    logger.warn('VITE_LLM_API_KEY not found, skipping AI prediction');
    return null;
  }

  logger.info('Generating AI expense prediction...');
  const now = dayjs();

  // Get last 6 months of data
  const sixMonthsAgo = now.subtract(6, 'month').startOf('month').toDate();
  const transactions = await Transaction.find({
    user: userId,
    type: 'expense',
    date: { $gte: sixMonthsAgo },
  }).sort({ date: 1 });

  if (transactions.length === 0) return null;

  // Group by month
  const monthlyData: Record<string, number> = {};
  transactions.forEach(t => {
    const monthKey = dayjs(t.date).format('YYYY-MM');
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + t.amount;
  });

  const currentMonthKey = now.format('YYYY-MM');
  const currentMonthSpent = monthlyData[currentMonthKey] || 0;
  const daysInMonth = now.daysInMonth();
  const currentDay = now.date();

  const historyString = Object.entries(monthlyData)
    .filter(([key]) => key !== currentMonthKey)
    .map(([key, amount]) => `${key}: ₹${amount}`)
    .join('\n');

  const prompt = `
    You are a financial analyst AI.
    
    Analyze the following monthly expense history:
    ${historyString}
    
    Current month (${currentMonthKey}) so far (Day ${currentDay}/${daysInMonth}): ₹${currentMonthSpent}
    
    TASK: Predict the TOTAL expense for the current month (${currentMonthKey}) based on:
    1. Historical trends (average, seasonality).
    2. Current month's pace.
    3. Any obvious patterns.
    
    OUTPUT JSON ONLY:
    {
      "predictedAmount": number,
      "reasoning": "short explanation (max 2 sentences)",
      "confidence": number (0.0 to 1.0)
    }
  `;

  try {
    const response = await axios.post(
      `${API_ENDPOINT}?key=${API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 65536 }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const cleanJson = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(cleanJson);

    return {
      predictedAmount: result.predictedAmount,
      reasoning: result.reasoning,
      confidence: result.confidence
    };
  } catch (error) {
    logger.error('AI Prediction failed', { error });
    return null;
  }
};


export interface CategorySpike {
  category: string;
  currentMonth: number;
  lastMonth: number;
  spike: number;
  spikePercent: number;
}

export interface OverspendingWarning {
  predictedOverspend: number;
  currentPace: number;
  daysRemaining: number;
  message: string;
}

export interface SubscriptionPrediction {
  merchant: string;
  amount: number;
  nextChargeDate: Date;
  frequency: string;
}

export interface RepeatedMerchant {
  merchant: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
  lastTransaction: Date;
}

export const detectCategorySpike = async (userId: string): Promise<CategorySpike | null> => {
  logger.info('Detecting category spike vs last month…');
  const now = dayjs();
  const currentMonth = now.month() + 1;
  const currentYear = now.year();
  const lastMonth = now.subtract(1, 'month').month() + 1;
  const lastYear = now.subtract(1, 'month').year();

  const currentStart = dayjs(`${currentYear}-${currentMonth}-01`).startOf('month').toDate();
  const currentEnd = dayjs(`${currentYear}-${currentMonth}-01`).endOf('month').toDate();
  const lastStart = dayjs(`${lastYear}-${lastMonth}-01`).startOf('month').toDate();
  const lastEnd = dayjs(`${lastYear}-${lastMonth}-01`).endOf('month').toDate();

  const [currentTxns, lastTxns] = await Promise.all([
    Transaction.find({ user: userId, type: 'expense', date: { $gte: currentStart, $lte: currentEnd } }).populate('category'),
    Transaction.find({ user: userId, type: 'expense', date: { $gte: lastStart, $lte: lastEnd } }).populate('category'),
  ]);

  const currentByCat: Record<string, number> = {};
  const lastByCat: Record<string, number> = {};

  currentTxns.forEach((t) => {
    const catName = (t.category as any)?.name || 'Unknown';
    currentByCat[catName] = (currentByCat[catName] || 0) + t.amount;
  });

  lastTxns.forEach((t) => {
    const catName = (t.category as any)?.name || 'Unknown';
    lastByCat[catName] = (lastByCat[catName] || 0) + t.amount;
  });

  let maxSpike = 0;
  let spikeCategory: CategorySpike | null = null;

  Object.keys(currentByCat).forEach((cat) => {
    const current = currentByCat[cat];
    const last = lastByCat[cat] || 0;
    if (last > 0) {
      const spike = current - last;
      const spikePercent = (spike / last) * 100;
      if (spikePercent > maxSpike) {
        maxSpike = spikePercent;
        spikeCategory = {
          category: cat,
          currentMonth: current,
          lastMonth: last,
          spike,
          spikePercent: Math.round(spikePercent * 10) / 10,
        };
      }
    }
  });

  return spikeCategory;
};

export const predictOverspending = async (userId: string): Promise<OverspendingWarning | null> => {
  logger.info('Predicting overspending for current month…');
  const now = dayjs();
  const month = now.month() + 1;
  const year = now.year();
  const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
  const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();
  const today = now.toDate();

  const transactions = await Transaction.find({
    user: userId,
    type: 'expense',
    date: { $gte: startDate, $lte: today },
  });

  const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const daysElapsed = now.date();
  const totalDays = now.daysInMonth();
  const daysRemaining = totalDays - daysElapsed;

  if (daysElapsed === 0) return null;

  const currentPace = spent / daysElapsed;
  const projectedSpend = currentPace * totalDays;

  // Get budget if available
  const last3Months = [];
  for (let i = 1; i <= 3; i++) {
    const m = now.subtract(i, 'month').month() + 1;
    const y = now.subtract(i, 'month').year();
    const mStart = dayjs(`${y}-${m}-01`).startOf('month').toDate();
    const mEnd = dayjs(`${y}-${m}-01`).endOf('month').toDate();
    const mTxns = await Transaction.find({
      user: userId,
      type: 'expense',
      date: { $gte: mStart, $lte: mEnd },
    });
    const mTotal = mTxns.reduce((sum, t) => sum + t.amount, 0);
    last3Months.push(mTotal);
  }

  const avgMonthlyExpense = last3Months.reduce((sum, v) => sum + v, 0) / last3Months.length || projectedSpend;
  const predictedOverspend = projectedSpend - avgMonthlyExpense;

  if (predictedOverspend <= 0) return null;

  return {
    predictedOverspend: Math.round(predictedOverspend),
    currentPace: Math.round(currentPace),
    daysRemaining,
    message: `Based on current pace, you will overspend by ₹${Math.round(predictedOverspend).toLocaleString('en-IN')} this month.`,
  };
};

export const predictSubscriptions = async (userId: string): Promise<SubscriptionPrediction[]> => {
  logger.info('Predicting upcoming subscription charges…');
  const now = dayjs();
  const next30Days = now.add(30, 'day').toDate();

  const recurringTxns = await Transaction.find({
    user: userId,
    type: 'expense',
    isRecurring: true,
    'recurrence.nextRun': { $lte: next30Days },
  });

  return recurringTxns.map((t) => ({
    merchant: t.title,
    amount: t.amount,
    nextChargeDate: (t.recurrence?.nextRun || now.toDate()) as Date,
    frequency: t.recurrence?.frequency || 'monthly',
  }));
};

export const detectRepeatedMerchants = async (userId: string): Promise<RepeatedMerchant[]> => {
  logger.info('Detecting repeated merchant patterns…');
  const now = dayjs();
  const last90Days = now.subtract(90, 'day').toDate();

  const transactions = await Transaction.find({
    user: userId,
    type: 'expense',
    date: { $gte: last90Days },
  });

  const merchantMap: Record<string, { count: number; total: number; lastDate: Date }> = {};

  transactions.forEach((t) => {
    const merchant = t.title.trim();
    if (!merchantMap[merchant]) {
      merchantMap[merchant] = { count: 0, total: 0, lastDate: t.date };
    }
    merchantMap[merchant].count += 1;
    merchantMap[merchant].total += t.amount;
    if (t.date > merchantMap[merchant].lastDate) {
      merchantMap[merchant].lastDate = t.date;
    }
  });

  return Object.entries(merchantMap)
    .filter(([_, data]) => data.count >= 3)
    .map(([merchant, data]) => ({
      merchant,
      count: data.count,
      totalAmount: data.total,
      avgAmount: Math.round(data.total / data.count),
      lastTransaction: data.lastDate,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

export interface PredictedBill {
  merchant: string;
  amount: number;
  expectedDate: string;
  confidence: number;
  lastPaid: string;
}

export interface AIInsight {
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
}

/**
 * Predict upcoming bills based on recurring transaction patterns
 */
export const predictBills = async (userId: string): Promise<PredictedBill[]> => {
  logger.info('Predicting bills for user...');

  const now = dayjs();
  const sixMonthsAgo = now.subtract(6, 'month').toDate();

  const expenses = await Transaction.find({
    user: userId,
    type: 'expense',
    date: { $gte: sixMonthsAgo },
  }).sort({ date: -1 });

  if (expenses.length < 2) return [];

  const merchantGroups = new Map<string, any[]>();

  // Group by exact transaction title
  expenses.forEach(t => {
    const title = t.title?.trim() || 'unknown';

    if (!merchantGroups.has(title)) {
      merchantGroups.set(title, []);
    }
    merchantGroups.get(title)?.push(t);
  });

  const predictedBills: PredictedBill[] = [];
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
          merchant: txns[0].title, // Use most recent name
          amount: parseFloat(avgAmount.toFixed(2)),
          expectedDate: nextDate.toISOString().split('T')[0],
          confidence: Math.min(0.95, 0.8 + (txns.length * 0.05)), // Higher confidence with more history
          lastPaid: lastDate.toISOString().split('T')[0]
        });
      }
    }
  });

  return predictedBills.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());
};

/**
 * Generate AI-powered financial insights
 */
export const generateAIInsights = async (userId: string): Promise<AIInsight[]> => {
  if (!API_KEY) {
    logger.warn('VITE_LLM_API_KEY not found, skipping AI insights');
    return [];
  }

  logger.info('Generating AI insights for user...');

  const now = dayjs();
  const threeMonthsAgo = now.subtract(3, 'month').toDate();

  const transactions = await Transaction.find({
    user: userId,
    date: { $gte: threeMonthsAgo },
  }).populate('category').sort({ date: -1 });

  if (transactions.length === 0) return [];

  // Calculate basic metrics
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  // Group by category
  const categoryMap = new Map<string, number>();
  transactions.forEach(t => {
    if (t.type === 'expense') {
      const catName = (t.category as any)?.name || 'Uncategorized';
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + t.amount);
    }
  });

  const topCategories = Array.from(categoryMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const monthsDiff = Math.max(1, (now.toDate().getTime() - threeMonthsAgo.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const avgMonthlyIncome = totalIncome / monthsDiff;
  const avgMonthlyExpense = totalExpenses / monthsDiff;
  const surplus = avgMonthlyIncome - avgMonthlyExpense;
  const savingsRate = avgMonthlyIncome > 0 ? ((surplus / avgMonthlyIncome) * 100) : 0;

  const prompt = `
    You are a financial advisor. Analyze this bank statement summary and provide 3-5 actionable insights.
    
    Data:
    - Income: ₹${totalIncome.toFixed(2)}
    - Expenses: ₹${totalExpenses.toFixed(2)}
    - Top Categories: ${JSON.stringify(topCategories)}
    - Monthly Surplus: ₹${surplus.toFixed(2)}
    - Savings Rate: ${savingsRate.toFixed(1)}%

    Return a JSON array of objects with this schema:
    [
      {
        "type": "warning" | "info" | "success",
        "title": "Short title",
        "message": "One sentence actionable advice"
      }
    ]
    
    JSON ONLY. No markdown.
  `;

  try {
    const response = await axios.post(
      `${API_ENDPOINT}?key=${API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 65536 }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];

    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    logger.error('Failed to generate AI insights', error);
    return [];
  }
};

