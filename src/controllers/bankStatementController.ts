import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { processGPayPDF } from '../services/gpay';
import Transaction from '../models/transaction';
import logger from '../utils/logger';
import axios from 'axios';
import { deductToken } from '../middleware/checkSubscription';

// AI Insights Configuration
const API_KEY = process.env.VITE_LLM_API_KEY;
const API_ENDPOINT = process.env.VITE_LLM_API_ENDPOINT;

/**
 * Detect recurring transactions and predict upcoming bills
 */
const predictBills = (transactions: any[]) => {
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
 * Generate AI insights using Gemini
 */
const generateAIInsights = async (analysis: any) => {
  if (!API_KEY) return [];

  const prompt = `
    You are a financial advisor. Analyze this bank statement summary and provide 3-5 actionable insights.
    
    Data:
    - Income: ${analysis.summary.totalIncome}
    - Expenses: ${analysis.summary.totalExpenses}
    - Top Categories: ${JSON.stringify(analysis.categories.slice(0, 3))}
    - Surplus: ${analysis.updatedSurplus}
    - Savings Rate: ${analysis.updatedSavingsRate}%

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

/**
 * Generate analysis from imported transactions
 */
const generateAnalysis = async (transactions: any[]) => {
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
      aiInsights: []
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

  // Generate AI Insights
  const aiInsights = await generateAIInsights(analysisBase);

  return {
    ...analysisBase,
    predictedBills,
    aiInsights
  };
};

export const uploadBankStatement = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return sendError(res, 'No PDF files uploaded', 400);
    }

    // Deduct token if not premium
    const tokenDeducted = await deductToken(userId);
    // Note: Middleware checkTokenOrPremium already ensures user has access (Premium or Token > 0)
    // But deductToken handles the actual deduction logic safely.

    logger.info(`Processing ${files.length} GPay PDF file(s) for user ${userId}`);

    let totalImported = 0;
    let totalErrors = 0;
    const importBatchId = new Date().toISOString();

    for (const file of files) {
      if (file.mimetype !== 'application/pdf') {
        logger.warn(`Skipping non-PDF file: ${file.originalname}`);
        continue;
      }

      try {
        logger.info(`Processing ${file.originalname}...`);

        // Process GPay PDF through 3-layer pipeline
        const result = await processGPayPDF(file.buffer);

        logger.info(`Extracted ${result.transactions.length} transactions (method: ${result.method}, confidence: ${(result.confidence * 100).toFixed(0)}%)`);

        // Save transactions to database
        logger.info(`Processing ${result.transactions.length} transactions for save...`);

        for (const txn of result.transactions) {
          try {
            const transactionType = txn.type === 'debit' ? 'expense' : 'income';
            logger.info(`Saving ${transactionType}: ${txn.description} - ₹${txn.amount.toFixed(2)} (${txn.type})`);

            await Transaction.create({
              user: userId,
              title: txn.description.substring(0, 50),
              amount: parseFloat(txn.amount.toFixed(2)),
              type: transactionType,
              category: 'Uncategorized',
              date: new Date(txn.date),
              notes: `GPay Import | ${txn.time || ''} | TxnID: ${txn.transaction_id || 'N/A'} | ${txn.account || ''} | Raw: ${txn.raw}`,
              source: 'gpay-pdf',
              importedAt: new Date(),
              importBatchId,
              tags: ['gpay', 'auto-import'],
            });
            totalImported++;
            logger.info(`✅ Saved ${transactionType} successfully`);
          } catch (error) {
            logger.error(`Failed to save transaction:`, error);
            totalErrors++;
          }
        }

      } catch (error: any) {
        logger.error(`Error processing PDF ${file.originalname}:`, error);
        totalErrors++;
      }
    }

    // Generate analysis from imported transactions
    const importedTransactions = await Transaction.find({
      user: userId,
      importBatchId,
    }).populate('category');

    // Calculate analysis
    const analysis = await generateAnalysis(importedTransactions);

    return sendSuccess(res, {
      import: {
        imported: totalImported,
        duplicates: 0,
        errors: totalErrors,
      },
      analysis,
    });

  } catch (error: any) {
    logger.error('GPay PDF upload failed', { error });
    return sendError(res, error.message || 'Failed to process GPay PDF', 500);
  }
};

