import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/apiResponse';
import Report from '../models/report';
import fs from 'fs';
import path from 'path';
import Transaction from '../models/transaction';
import User from '../models/user';
import { generateAnalysis } from '../services/analysisService';
import { generatePDFReport } from '../services/pdfReportService';
import { sendEmail } from '../services/emailService';
import { createNotification } from '../services/notificationService';
import logger from '../utils/logger';

export const listReports = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const reports = await Report.find({ user: userId })
            .sort({ generatedAt: -1 })
            .limit(20);

        return sendSuccess(res, reports);
    } catch (error: any) {
        return sendError(res, error.message || 'Failed to list reports');
    }
};

export const downloadReport = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const reportId = req.params.reportId;

        const report = await Report.findOne({ _id: reportId, user: userId });

        if (!report) {
            return sendError(res, 'Report not found', 404);
        }

        if (report.status !== 'completed' || !report.filePath) {
            return sendError(res, 'Report is not ready or has failed', 400);
        }

        if (!fs.existsSync(report.filePath)) {
            return sendError(res, 'Report file expired or missing', 404);
        }

        const filename = `Financial_Insights_${report.generatedAt.toISOString().split('T')[0]}.pdf`;

        res.download(report.filePath, filename, (err) => {
            if (err) {
                // Handle error, but response might have started
                console.error('Download error:', err);
            }
        });

    } catch (error: any) {
        return sendError(res, error.message || 'Failed to download report');
    }
};

/**
 * Generate and email the financial insights report
 */
export const emailReport = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        // 1. Fetch User
        const user = await User.findById(userId);
        if (!user) {
            return sendError(res, 'User not found', 404);
        }

        // 2. Fetch Transactions (Last 30 Days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const transactions = await Transaction.find({
            user: userId,
            date: { $gte: startDate, $lte: endDate }
        }).populate('category');

        if (transactions.length === 0) {
            return sendError(res, 'No transactions found for the last 30 days to generate a report.', 400);
        }

        // 3. Generate Analysis
        const analysis = await generateAnalysis(transactions);

        // 4. Generate PDF
        const pdfPath = await generatePDFReport({
            user: { name: user.name, email: user.email },
            period: {
                startDate: startDate.toLocaleDateString(),
                endDate: endDate.toLocaleDateString()
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
            topMerchants: [], // Populate if available in analysis (analysisService doesn't return fit yet, but template handles empty)
            insights: analysis.aiInsights.map((i: any) => ({ title: i.title, message: i.message, type: i.type })),
            recommendations: analysis.aiInsights.filter((i: any) => i.type !== 'info').map((i: any) => i.message),
            spendingTwins: analysis.spendingTwins
        });

        // 5. Save Report Reference
        await Report.create({
            user: userId,
            filePath: pdfPath,
            status: 'completed'
        });

        // 6. Send Email
        await sendEmail(
            user.email,
            'Your Financial Insights Report - RupeeRev',
            `
            <h1>Your Financial Report is Ready!</h1>
            <p>Hello ${user.name},</p>
            <p>Here is your financial insights report for the last 30 days.</p>
            <p>We analyzed ${transactions.length} transactions.</p>
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

        // 7. Notify User
        await createNotification(userId, {
            type: 'summary',
            title: 'Report Emailed',
            message: `Your report has been sent to ${user.email}.`,
        } as any);

        return sendSuccess(res, { message: 'Report generated and emailed successfully' });

    } catch (error: any) {
        logger.error('Failed to email report', error);
        return sendError(res, error.message || 'Failed to email report');
    }
};
