import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

interface ReportData {
  user: { name: string; email: string };
  period: { startDate: string; endDate: string };
  summary: {
    income: string;
    expenses: string;
    savings: string;
    savingsRate: number;
    transactionCount: number;
  };
  categoryBreakdown: Array<{ name: string; count: number; total: string; percentage: number }>;
  topMerchants: Array<{ merchant: string; amount: string }>;
  insights: Array<{ title: string; message: string; type: string }>;
  predictedExpenses?: Array<{ category: string; amount: number; predictedDate: any; confidence: any }>;
  savingTips?: string[];
  riskySpending?: string[];
  considerReducing?: string[];
  recommendations: string[];
  spendingTwins?: {
    goodYou: { expenses: number; surplus: number; netWorth1Y: number; netWorth3Y: number; netWorth5Y: number };
    currentYou: { expenses: number; surplus: number; netWorth1Y: number; netWorth3Y: number; netWorth5Y: number };
    badYou: { expenses: number; surplus: number; netWorth1Y: number; netWorth3Y: number; netWorth5Y: number };
  };
}

const TEMPLATE_PATH = path.join(__dirname, '../templates/insight-report.hbs');
const TEMP_DIR = path.join(__dirname, '../../temp-reports');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export const generatePDFReport = async (data: ReportData): Promise<string> => {
  try {
    // 1. Compile Template
    handlebars.registerHelper('formatNumber', (num) => {
      if (typeof num !== 'number') return num;
      return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    });

    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    const template = handlebars.compile(templateHtml);
    const html = template(data);

    // 2. Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // 3. Set Content
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // 4. Generate PDF
    const filename = `report-${randomUUID()}.pdf`;
    const filePath = path.join(TEMP_DIR, filename);

    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px',
      },
    });

    await browser.close();
    logger.info(`Generated PDF report at ${filePath}`);

    return filePath;
  } catch (error) {
    logger.error('Failed to generate PDF report', error);
    throw error;
  }
};

/**
 * Cleanup old reports (older than 1 hour)
 */
export const cleanupOldReports = () => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > ONE_HOUR) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old report: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Failed to cleanup old reports', error);
  }
};
