import pdfParse from 'pdf-parse';
import logger from '../utils/logger';
import dayjs from 'dayjs';
import Transaction from '../models/transaction';
import Category from '../models/category';
import { assignCategory } from './categoryAssigner.service';

export interface ParsedTransaction {
  date: Date;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  merchant?: string;
  category?: string;
}

const DATE_PATTERNS = [
  /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/g,
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/gi,
];

const AMOUNT_PATTERNS = [
  /₹\s*([\d,]+\.?\d*)/g,
  /INR\s*([\d,]+\.?\d*)/g,
  /Rs\.?\s*([\d,]+\.?\d*)/g,
  /([\d,]+\.?\d*)\s*(?:CR|DR|Cr|Dr)/g,
];

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const parseDate = (text: string): Date | null => {
  for (const pattern of DATE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      try {
        if (match[2] && MONTH_NAMES[match[2].toLowerCase()]) {
          // Format: DD MMM YYYY
          const day = parseInt(match[1]);
          const month = MONTH_NAMES[match[2].toLowerCase()];
          const year = parseInt(match[3]) + (match[3].length === 2 ? 2000 : 0);
          return dayjs(`${year}-${month}-${day}`).toDate();
        } else {
          // Format: DD/MM/YYYY or DD-MM-YYYY
          const day = parseInt(match[1]);
          const month = parseInt(match[2]);
          const year = parseInt(match[3]) + (match[3].length === 2 ? 2000 : 0);
          return dayjs(`${year}-${month}-${day}`).toDate();
        }
      } catch (e) {
        continue;
      }
    }
  }
  return null;
};

const parseAmount = (text: string): number | null => {
  for (const pattern of AMOUNT_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      try {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) return amount;
      } catch (e) {
        continue;
      }
    }
  }
  return null;
};

const detectTransactionType = (description: string, amount: number): 'income' | 'expense' => {
  const lower = description.toLowerCase();
  const incomeKeywords = ['salary', 'credit', 'deposit', 'refund', 'interest', 'dividend', 'transfer in'];
  const expenseKeywords = ['debit', 'payment', 'purchase', 'withdrawal', 'transfer out', 'emi', 'bill'];

  if (incomeKeywords.some((kw) => lower.includes(kw))) return 'income';
  if (expenseKeywords.some((kw) => lower.includes(kw))) return 'expense';

  // Heuristic: Large amounts are often income, small frequent are expenses
  return amount > 10000 ? 'income' : 'expense';
};

const extractMerchant = (description: string): string => {
  // Common patterns: "PAYMENT TO MERCHANT NAME", "UPI/MERCHANT", etc.
  const patterns = [
    /(?:TO|FROM|PAYMENT TO|PAYMENT FROM)\s+([A-Z\s]+)/i,
    /UPI\/([A-Z\s]+)/i,
    /([A-Z]{2,}\s+[A-Z]{2,})/,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 50);
    }
  }

  // Fallback: first few words
  return description.split(/\s+/).slice(0, 3).join(' ').substring(0, 50);
};

export const parseBankStatementPDF = async (pdfBuffer: Buffer): Promise<ParsedTransaction[]> => {
  logger.info('Parsing bank statement PDF…');
  const data = await pdfParse(pdfBuffer);
  const text = data.text;

  logger.info(`Extracted ${text.length} characters from PDF`);

  // Normalize text
  let normalized = text;
  normalized = normalized.replace(/Page\s+\d+\s+of\s+\d+/gi, '');
  normalized = normalized.replace(/\(Value Date.*?\)/gi, '');

  const rawLines = normalized
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line) => line.length > 0);

  const lines: string[] = [];
  let hasReachedTable = false;

  for (const line of rawLines) {
    const isHeaderLine = /^date\s+.*narration/i.test(line) || /narration\s+chg\/ref/i.test(line);
    if (isHeaderLine) {
      hasReachedTable = true;
      continue; // skip header rows (may appear per page)
    }

    const startsWithDate = /^\d{2}[-/]\d{2}[-/]\d{2,4}/.test(line) || /^\d{4}[-/]\d{2}[-/]\d{2}/.test(line);

    if (!hasReachedTable) {
      if (startsWithDate) {
        hasReachedTable = true;
      } else {
        continue; // ignore header/address blocks before table
      }
    }

    // Even after table started, skip lines that are clearly headers/footers
    if (/^period\s*:/i.test(line) || /^account\s+no/i.test(line) || /^branch/i.test(line)) {
      continue;
    }

    if (startsWithDate || line.length > 10) {
      lines.push(line);
    }
  }

  logger.info(`Processing ${lines.length} candidate lines after header removal...`);

  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    // Special handling for Kotak-style lines without spaces between fields:
    // 01-09-2025UPI/IRCTCAPPUPI/...70.00(Cr)501.50(Cr)
    const kotakPattern =
      /^(\d{2}-\d{2}-\d{4})(.+?)([\d,]+\.?\d*)\((Dr|Cr)\)([\d,]+\.?\d*)\((Dr|Cr)\)/i;
    const kotakMatch = line.match(kotakPattern);

    if (kotakMatch) {
      const [, dateStr, narrationRaw, amountStr1, drCr, amountStr2] = kotakMatch;
      const [day, month, year] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const a1 = parseFloat(amountStr1.replace(/,/g, ''));
      const a2 = parseFloat(amountStr2.replace(/,/g, ''));
      const amount = Math.min(a1, isNaN(a2) ? a1 : a2);
      if (!isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        // Skip obviously invalid parsed amounts; let other patterns try
        continue;
      }
      const narration = narrationRaw.trim();
      const isDebit = drCr.toLowerCase() === 'dr';

      transactions.push({
        date,
        amount,
        description: narration,
        type: isDebit ? 'expense' : 'income',
        merchant: extractMerchant(narration),
      });
      continue;
    }

    // Pattern 1: DD-MM-YYYY format with Dr/Cr indicators
    // Example: 01-08-2025 UPI/NEFT/Ram Card/54321 UPI54321234567 75.00(Dr) 601.54(Cr)
    // Updated to allow hyphens in RefNo and more flexible spacing
    const pattern1 = /(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([A-Z0-9-]+)\s+([\d,]+\.?\d*)\s*\(?(Dr|Cr)\)?\s+([\d,]+\.?\d*)\s*\(?(Dr|Cr)\)?/i;
    const match1 = line.match(pattern1);

    if (match1) {
      const [, dateStr, narration, refNo, amount1, type1, amount2, type2] = match1;

      // Parse date DD-MM-YYYY to Date object
      const [day, month, year] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);

      const isDebit = type1.toLowerCase() === 'dr';
      const amount = parseFloat(amount1.replace(/,/g, ''));

      transactions.push({
        date,
        amount,
        description: narration.trim(),
        type: isDebit ? 'expense' : 'income',
        merchant: extractMerchant(narration.trim()),
      });
      continue;
    }

    // Pattern 2: Simpler format - Date Narration Amount Balance
    // Updated to handle optional (Dr)/(Cr) suffixes
    const pattern2 = /(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s*\(?(?:Dr|Cr)?\)?\s+([\d,]+\.?\d*)\s*\(?(?:Dr|Cr)?\)?/;
    const match2 = line.match(pattern2);

    if (match2) {
      const [, dateStr, narration, amountStr, balanceStr] = match2;

      const [day, month, year] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const amount = parseFloat(amountStr.replace(/,/g, ''));

      const isDebit = /debit|withdrawal|payment|transfer|upi.*to/i.test(narration);

      transactions.push({
        date,
        amount,
        description: narration.trim(),
        type: isDebit ? 'expense' : 'income',
        merchant: extractMerchant(narration.trim()),
      });
      continue;
    }

    // Pattern 3: YYYY-MM-DD format
    const pattern3 = /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([\d,]+\.?\d*)\s*\(?(Dr|Cr)\)?\s+([\d,]+\.?\d*)/i;
    const match3 = line.match(pattern3);

    if (match3) {
      const [, dateStr, narration, amountStr, type, balanceStr] = match3;
      const date = new Date(dateStr);
      const amount = parseFloat(amountStr.replace(/,/g, ''));

      transactions.push({
        date,
        amount,
        description: narration.trim(),
        type: type.toLowerCase() === 'dr' ? 'expense' : 'income',
        merchant: extractMerchant(narration.trim()),
      });
    }
  }

  logger.info(`Parsed ${transactions.length} transactions from PDF`);

  if (transactions.length > 0) {
    logger.info(`Sample transaction: ${transactions[0].date.toISOString().split('T')[0]} - ${transactions[0].description} - ₹${transactions[0].amount}`);
  } else {
    logger.warn('No transactions found! Check if PDF format matches expected patterns.');
    logger.info(`First 5 lines of text:\n${lines.slice(0, 5).join('\n')}`);
  }

  return transactions;
};

export const importTransactionsFromPDF = async (
  userId: string,
  parsedTransactions: ParsedTransaction[],
  importBatchId: string
): Promise<{ imported: number; duplicates: number; errors: number }> => {
  logger.info(`Importing ${parsedTransactions.length} transactions for user ${userId}…`);

  const categories = await Category.find({ $or: [{ user: userId }, { user: null }] });
  const categoryMap: Record<string, string> = {};
  categories.forEach((cat) => {
    categoryMap[cat.name.toLowerCase()] = cat._id.toString();
  });

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  for (const parsed of parsedTransactions) {
    try {
      // Check for duplicates (same date, amount, description)
      const existing = await Transaction.findOne({
        user: userId,
        date: {
          $gte: dayjs(parsed.date).startOf('day').toDate(),
          $lte: dayjs(parsed.date).endOf('day').toDate(),
        },
        amount: parsed.amount,
        title: { $regex: parsed.description.substring(0, 20), $options: 'i' },
      });

      if (existing) {
        duplicates++;
        continue;
      }

      // Auto-categorize with learning + rules, respecting income/expense type
      const assignment = await assignCategory(userId, parsed.description, categories as any, parsed.type);

      logger.info('PDF import categorization', {
        userId,
        description: parsed.description,
        categoryId: assignment.categoryId,
        source: assignment.source,
        confidence: assignment.confidence,
        attempts: assignment.attempts,
      });

      // Get default account
      const Account = (await import('../models/account')).default;
      const accounts = await Account.find({ user: userId });
      const accountId = accounts[0]?._id || userId;

      await Transaction.create({
        user: userId,
        title: parsed.description.substring(0, 100),
        amount: parsed.amount,
        type: parsed.type,
        category: assignment.categoryId,
        account: accountId,
        date: parsed.date,
        notes: `Imported from PDF${parsed.merchant ? ` - Merchant: ${parsed.merchant}` : ''}`,
        tags: ['fromPDF'],
        source: 'pdf',
        importedAt: new Date(),
        categorySource: assignment.source,
        categoryConfidence: assignment.confidence,
        importBatchId,
      });

      imported++;
    } catch (error) {
      logger.error(`Error importing transaction: ${parsed.description}`, { error });
      errors++;
    }
  }

  logger.info(`Import complete: ${imported} imported, ${duplicates} duplicates, ${errors} errors`);
  return { imported, duplicates, errors };
};

