import { ExtractedTransaction } from './llmTransactionExtractor';
// import Category from '../models/category';

export interface MergedTransaction extends ExtractedTransaction {
    category?: string;
    categoryName?: string;
}

// Simple categorization based on narration keywords
const categorizeTransaction = async (narration: string): Promise<string> => {
    const lowerNarration = narration.toLowerCase();

    // Simple keyword matching
    const keywords: Record<string, string[]> = {
        'Food & Dining': ['restaurant', 'cafe', 'food', 'zomato', 'swiggy', 'dining', 'pizza', 'burger'],
        'Transportation': ['uber', 'ola', 'fuel', 'petrol', 'diesel', 'parking', 'metro', 'bus'],
        'Shopping': ['amazon', 'flipkart', 'shopping', 'mall', 'store', 'purchase'],
        'Utilities': ['electricity', 'water', 'gas', 'internet', 'mobile', 'recharge', 'bill'],
        'Entertainment': ['movie', 'netflix', 'spotify', 'prime', 'hotstar', 'entertainment'],
        'Healthcare': ['hospital', 'pharmacy', 'doctor', 'medical', 'health', 'clinic'],
        'Salary': ['salary', 'wages', 'payroll', 'income'],
        'Transfer': ['transfer', 'neft', 'imps', 'rtgs', 'upi'],
    };

    for (const [categoryName, keywordList] of Object.entries(keywords)) {
        for (const keyword of keywordList) {
            if (lowerNarration.includes(keyword)) {
                return categoryName;
            }
        }
    }

    return 'Uncategorized';
};

// Merge duplicate transactions
export const mergeTransactions = async (transactions: ExtractedTransaction[], userId?: string): Promise<MergedTransaction[]> => {
    const merged: MergedTransaction[] = [];
    const seen = new Set<string>();

    for (const txn of transactions) {
        // Create a unique key based on date + amount + first 20 chars of narration
        const key = `${txn.date}_${txn.amount}_${txn.narration.substring(0, 20)}`;

        if (seen.has(key)) {
            console.log(`Skipping duplicate transaction: ${key}`);
            continue;
        }

        seen.add(key);

        // Clean narration
        let cleanNarration = txn.narration
            .replace(/\s+/g, ' ')
            .trim();

        // Fix date format if needed (ensure YYYY-MM-DD)
        let cleanDate = txn.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
            // Try to parse and reformat
            const dateMatch = cleanDate.match(/(\d{2,4})[/-](\d{2})[/-](\d{2,4})/);
            if (dateMatch) {
                const [, p1, p2, p3] = dateMatch;
                // Assume DD-MM-YYYY or YYYY-MM-DD
                if (p1.length === 4) {
                    cleanDate = `${p1}-${p2}-${p3}`;
                } else {
                    cleanDate = `${p3}-${p2}-${p1}`;
                }
            }
        }

        // Categorize
        const categoryName = await categorizeTransaction(cleanNarration);

        merged.push({
            ...txn,
            date: cleanDate,
            narration: cleanNarration,
            category: categoryName,
            categoryName: categoryName
        });
    }

    console.log(`Merged ${transactions.length} transactions into ${merged.length} unique transactions`);
    return merged;
};
