import dotenv from 'dotenv';
import path from 'path';
// Load env vars from root .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { generatePDFReport } from '../services/pdfReportService';
import { sendEmail } from '../services/emailService';
import fs from 'fs';

const testSystem = async () => {
    console.log('--- Starting System Test ---');

    console.log('\nTesting PDF Generation...');
    let pdfPath = '';
    try {
        const dummyData = {
            user: { name: 'Viral Ajudia', email: process.env.SMTP_USER || 'test@example.com' },
            period: { startDate: '01/01/2024', endDate: '31/01/2024' },
            summary: {
                income: "100,000",
                expenses: "40,000",
                savings: "60,000",
                savingsRate: 60,
                transactionCount: 45
            },
            categoryBreakdown: [
                { name: 'Food & Dining', count: 15, total: "8,000", percentage: 20 },
                { name: 'Shopping', count: 5, total: "12,000", percentage: 30 },
                { name: 'Utilities', count: 2, total: "5,000", percentage: 12.5 },
                { name: 'Rent', count: 1, total: "15,000", percentage: 37.5 }
            ],
            topMerchants: [],
            insights: [
                { title: 'Great Savings Rate', message: 'You saved 60% of your income this month. Excellent work!', type: 'success' },
                { title: 'High Food Spending', message: 'Your food spending is slightly higher than average.', type: 'warning' }
            ],
            recommendations: ['Consider investing your surplus in a mutual fund.', 'Track your daily food expenses.'],
            spendingTwins: {
                goodYou: {
                    expenses: 36000,
                    surplus: 64000,
                    netWorth1Y: 64000 * 12,
                    netWorth3Y: 64000 * 36,
                    netWorth5Y: 64000 * 60
                },
                currentYou: {
                    expenses: 40000,
                    surplus: 60000,
                    netWorth1Y: 60000 * 12,
                    netWorth3Y: 60000 * 36,
                    netWorth5Y: 60000 * 60
                },
                badYou: {
                    expenses: 44000,
                    surplus: 56000,
                    netWorth1Y: 56000 * 12,
                    netWorth3Y: 56000 * 36,
                    netWorth5Y: 56000 * 60
                }
            }
        };

        pdfPath = await generatePDFReport(dummyData);
        console.log(`✅ PDF Generated at: ${pdfPath}`);

    } catch (error: any) {
        console.error('❌ PDF Generation Failed:', error);
    }

    // 3. Test Email Sending with Attachment
    if (pdfPath && fs.existsSync(pdfPath)) {
        console.log('\nTesting Email Sending...');
        try {
            const targetEmail = process.env.SMTP_USER || 'test@example.com';
            console.log(`   Sending to: ${targetEmail}`);

            await sendEmail(
                targetEmail,
                'Sample Financial Insights Report (New Design)',
                '<h1>Sample Report</h1><p>Here is the sample report with the new design and Spending Twins section.</p>',
                [{ filename: 'Sample_Report.pdf', path: pdfPath }]
            );
            console.log('✅ Email Sent Successfully');
        } catch (error) {
            console.error('❌ Email Sending Failed:', error);
        }
    }

    console.log('\n--- Test Complete ---');
    process.exit(0);
};

testSystem();
