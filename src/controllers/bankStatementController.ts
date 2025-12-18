import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { processGPayPDF } from '../services/gpay';
import Transaction from '../models/transaction';
import logger from '../utils/logger';
import { deductToken } from '../middleware/checkSubscription';
import { generatePDFReport } from '../services/pdfReportService';
import Report from '../models/report';
import { createNotification } from '../services/notificationService';
import { sendEmail } from '../services/emailService';
import User from '../models/user';
import Category from '../models/category';
import { assignCategory } from '../services/categoryAssigner.service';

import { generateAnalysis } from '../services/analysisService';
import { generateAiInsights } from '../services/aiInsights.service';

// AI Insights Configuration
const API_KEY = process.env.VITE_LLM_API_KEY;
const API_ENDPOINT = process.env.VITE_LLM_API_ENDPOINT;



/**
 * Async worker to process bank statement and generate report
 */
const processBankStatementAsync = async (files: Express.Multer.File[], userId: string, importBatchId: string) => {
    logger.info(`[Job ${importBatchId}] Starting async processing for user ${userId}`);

    let totalImported = 0;
    let totalErrors = 0;

    try {
        const user = await User.findById(userId);
        if (!user) {
            logger.error(`User ${userId} not found for job ${importBatchId}`);
            return;
        }

        // Fetch Categories once for categorization
        let categories = await Category.find({
            $or: [{ user: userId }, { isDefault: true }]
        });

        const defaults = [
            { name: 'Food & Dining', type: 'expense', icon: 'restaurant', color: '#ff6347', isDefault: true, keywords: ['food', 'swiggy', 'zomato'] },
            { name: 'Travel', type: 'expense', icon: 'flight', color: '#4682b4', isDefault: true, keywords: ['travel', 'ola', 'uber'] },
            { name: 'Groceries', type: 'expense', icon: 'shopping_cart', color: '#32cd32', isDefault: true, keywords: ['grocery'] },
            { name: 'Utilities', type: 'expense', icon: 'bolt', color: '#ffd700', isDefault: true, keywords: ['utility', 'bill'] },
            { name: 'Shopping', type: 'expense', icon: 'local_mall', color: '#da70d6', isDefault: true, keywords: ['shopping'] },
            { name: 'Medical', type: 'expense', icon: 'local_hospital', color: '#ff0000', isDefault: true, keywords: ['medical', 'pharmacy'] },
            { name: 'Entertainment', type: 'expense', icon: 'movie', color: '#8a2be2', isDefault: true, keywords: ['movie'] },
            { name: 'Salary', type: 'income', icon: 'attach_money', color: '#00ff00', isDefault: true, keywords: ['salary'] },
            { name: 'Transfers', type: 'expense', icon: 'swap_horiz', color: '#808080', isDefault: true, keywords: ['transfer'] },
            { name: 'Investment', type: 'expense', icon: 'trending_up', color: '#00ced1', isDefault: true, keywords: ['investment'] }
        ];

        // Identify missing defaults
        const missingDefaults = defaults.filter(d =>
            !categories.some(c => c.name === d.name && c.type === d.type)
        );

        if (missingDefaults.length > 0) {
            const created = await Category.insertMany(missingDefaults.map(d => ({ ...d, user: userId })));
            categories = categories.concat(created as any);
            logger.info(`[Job ${importBatchId}] Seeded ${created.length} missing default categories for user ${userId}`);
        }

        logger.info(`[Job ${importBatchId}] Available Categories for matching: ${categories.map(c => c.name).join(', ')}`);


        for (const file of files) {
            if (file.mimetype !== 'application/pdf') {
                continue;
            }

            try {
                // Process GPay PDF through 3-layer pipeline
                const result = await processGPayPDF(file.buffer);

                // Save transactions to database
                for (const txn of result.transactions) {
                    try {
                        const transactionType = txn.type === 'debit' ? 'expense' : 'income';

                        // Categorize Transaction
                        let categoryId: string | undefined | any = undefined;
                        if (transactionType === 'expense') {
                            const assignment = await assignCategory(userId, txn.description, categories, 'expense');
                            categoryId = assignment.categoryId;
                        } else {
                            // For income, maybe default to Salary or Income category if exists, or just leave unassigned/let FE handle it?
                            // Usually categorizer handles both if passed correctly.
                            const assignment = await assignCategory(userId, txn.description, categories, 'income');
                            categoryId = assignment.categoryId;
                        }

                        // Ensure categoryId is valid, else use/create Uncategorized
                        // Ensure categoryId is valid, else use/create Uncategorized
                        if (!categoryId) {
                            logger.warn(`[Job ${importBatchId}] No category found for "${txn.description}". Fallback to Uncategorized.`);

                            let uncategorized: any = categories.find(c => c.name === 'Uncategorized' && c.type === transactionType);
                            if (!uncategorized) {
                                // Try finding globally or creating
                                uncategorized = await Category.findOne({ user: userId, name: 'Uncategorized', type: transactionType });
                                if (!uncategorized) {
                                    uncategorized = await Category.create({
                                        user: userId,
                                        name: 'Uncategorized',
                                        type: transactionType,
                                        icon: 'help',
                                        color: '#808080',
                                        isDefault: true
                                    });
                                    // Add to local cache to avoid re-querying
                                    categories.push(uncategorized);
                                }
                            }
                            categoryId = uncategorized._id;
                        } else {
                            const assignedCat = categories.find(c => c._id.toString() === categoryId);
                            logger.info(`[Job ${importBatchId}] Assigned "${txn.description}" -> ${assignedCat?.name} (${categoryId})`);
                        }

                        // Fallback to "Uncategorized" if logic returns nil, but usually it returns a fallback.
                        // If categoryId is still undefined, we should probably find the 'Uncategorized' explicitly or create it.
                        // For now, let's assume valid ID or nullable.
                        // Note: assignCategory service returns a fallback if no match, so categoryId should be valid.

                        await Transaction.create({
                            user: userId,
                            title: txn.description.substring(0, 50),
                            amount: parseFloat(txn.amount.toFixed(2)),
                            type: transactionType,
                            category: categoryId, // Mapped Category
                            date: new Date(txn.date),
                            notes: `GPay Import | ${txn.time || ''} | TxnID: ${txn.transaction_id || 'N/A'} | ${txn.account || ''} | Raw: ${txn.raw}`,
                            source: 'gpay-pdf',
                            importedAt: new Date(),
                            importBatchId,
                            tags: ['gpay', 'auto-import'],
                        });
                        totalImported++;
                    } catch (error) {
                        logger.error(`[Job ${importBatchId}] Transaction save failed`, error);
                        totalErrors++;
                    }
                }
            } catch (error: any) {
                logger.error(`Error processing PDF ${file.originalname}:`, error);
                totalErrors++;
            }
        }

        // Generate analysis from imported transactions
        logger.info(`[Job ${importBatchId}] Fetching imported transactions...`);
        const importedTransactions = await Transaction.find({
            user: userId,
            importBatchId,
        }).populate('category');
        logger.info(`[Job ${importBatchId}] Fetched ${importedTransactions.length} transactions`);

        if (importedTransactions.length === 0) {
            throw new Error('No transactions extracted');
        }

        // Calculate analysis
        logger.info(`[Job ${importBatchId}] Generating analysis...`);

        // Force regenerate AI insights to ensure fresh data for PDF
        try {
            logger.info(`[Job ${importBatchId}] Triggering fresh AI insights generation...`);
            await generateAiInsights(userId);
        } catch (err) {
            logger.error(`[Job ${importBatchId}] Failed to auto-generate insights`, err);
        }

        const analysis = await generateAnalysis(importedTransactions);
        logger.info(`[Job ${importBatchId}] Analysis generated. Income: ${analysis.summary.totalIncome}, Expense: ${analysis.summary.totalExpenses}`);

        // Generate PDF Report
        logger.info(`[Job ${importBatchId}] Generating PDF report...`);
        const pdfPath = await generatePDFReport({
            user: { name: user.name, email: user.email },
            period: {
                startDate: new Date(analysis.summary.dateRange.start).toLocaleDateString(),
                endDate: new Date(analysis.summary.dateRange.end).toLocaleDateString()
            },
            summary: {
                income: analysis.summary.totalIncome.toLocaleString(),
                expenses: analysis.summary.totalExpenses.toLocaleString(),
                savings: analysis.updatedSurplus.toLocaleString(),
                savingsRate: analysis.updatedSavingsRate,
                transactionCount: analysis.summary.totalImported
            },
            categoryBreakdown: analysis.categories.slice(0, 10).map((c: any) => ({
                name: c.name,
                count: c.count,
                total: c.total.toLocaleString(),
                percentage: analysis.summary.totalExpenses > 0 ? Math.round((c.total / analysis.summary.totalExpenses) * 100) : 0
            })),
            topMerchants: [], // Populate if available
            insights: analysis.aiInsights.map((i: any) => ({ title: i.title, message: i.message, type: i.type })),
            recommendations: analysis.aiInsights.filter((i: any) => i.type !== 'info').map((i: any) => i.message),
            spendingTwins: analysis.spendingTwins,

            // New Rich AI Fields
            predictedExpenses: analysis.predictedExpenses,
            savingTips: analysis.savingTips,
            riskySpending: analysis.riskySpending,
            considerReducing: analysis.considerReducing
        });

        // Save Report Reference
        await Report.create({
            user: userId,
            filePath: pdfPath,
            status: 'completed'
        });

        // Notify User in App
        await createNotification(userId, {
            type: 'summary',
            title: 'Report Ready',
            message: `Your financial insights report is ready. ${totalImported} transactions analyzed. Check your email or the Reports section.`,
        } as any);

        // 📧 Send Email to User
        try {
            await sendEmail(
                user.email,
                'Your Financial Insights Report - RupeeRev',
                `
            <h1>Your Financial Report is Ready!</h1>
            <p>Hello ${user.name},</p>
            <p>We have processed your bank statement and analyzed ${totalImported} transactions.</p>
            <p>Please find your detailed financial insights report attached.</p>
            <br/>
            <p>Best regards,<br/>Team RupeeRev</p>
          `,
                [
                    {
                        filename: 'Financial_Insights_Report.pdf',
                        path: pdfPath
                    }
                ]
            );
            logger.info(`[Job ${importBatchId}] Email sent to ${user.email}`);
        } catch (emailError) {
            logger.error(`[Job ${importBatchId}] Failed to send email`, emailError);
            // Don't fail the whole job if email fails, report is still downloadable
        }

        logger.info(`[Job ${importBatchId}] Completed. PDF generated at ${pdfPath}`);

    } catch (error) {
        logger.error(`[Job ${importBatchId}] Failed at step: ${totalImported > 0 ? 'Analysis/PDF' : 'Extraction'}`, error);
        await createNotification(userId, {
            type: 'summary',
            title: 'Analysis Failed',
            message: 'We encountered an issue analyzing your statements. Please try again.',
        } as any);
    }
}

export const uploadBankStatement = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
            return sendError(res, 'No PDF files uploaded', 400);
        }

        // Deduct token if not premium
        await deductToken(userId);

        const importBatchId = new Date().toISOString();

        // Trigger async processing (fire and forget)
        // We do NOT await this
        processBankStatementAsync(files, userId, importBatchId);

        return sendSuccess(res, {
            message: 'Processing started',
            jobId: importBatchId
        });

    } catch (error: any) {
        logger.error('GPay PDF upload failed', { error });
        return sendError(res, error.message || 'Failed to process GPay PDF', 500);
    }
};
