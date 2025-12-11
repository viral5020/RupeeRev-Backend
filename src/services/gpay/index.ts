import { extractGPayTransactionsWithVision } from './gpayVisionExtractor';
import { ExtractionResult } from './types';

/**
 * Main GPay PDF Processing Pipeline (Vision-based)
 * Uses Gemini Vision API to extract transactions directly from PDF images
 */

export const processGPayPDF = async (pdfBuffer: Buffer): Promise<ExtractionResult> => {
    console.log('\n🚀 Starting GPay PDF processing pipeline (Vision API)...\n');

    try {
        // Extract transactions directly using Gemini Vision
        const { transactions, pageCount } = await extractGPayTransactionsWithVision(pdfBuffer);

        if (transactions.length === 0) {
            console.warn('⚠️ No transactions found');
            return {
                transactions: [],
                method: 'vision',
                confidence: 0
            };
        }

        // Post-process transactions
        const processed = postProcessTransactions(transactions);

        // Calculate confidence based on results
        const confidence = calculateConfidence(processed.length, pageCount);

        console.log(`\n✅ Pipeline complete: ${processed.length} transactions extracted (confidence: ${(confidence * 100).toFixed(0)}%)\n`);

        return {
            transactions: processed,
            method: 'vision',
            confidence
        };

    } catch (error: any) {
        console.error('❌ GPay PDF processing failed:', error.message);
        throw error;
    }
};

/**
 * Post-process and deduplicate transactions
 */
const postProcessTransactions = (transactions: any[]) => {
    console.log('🔧 Post-processing transactions...');

    const processed = transactions.map((txn) => {
        // Clean amount (preserve decimals, don't round)
        let amountStr = String(txn.amount)
            .replace(/O/g, "0")
            .replace(/[lI|]/g, "1")
            .replace(/[^0-9.]/g, "");
        const amount = parseFloat(parseFloat(amountStr || "0").toFixed(2));

        // Validate date format
        let date = txn.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const parsed = new Date(date);
            date = !isNaN(parsed.getTime())
                ? parsed.toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0];
        }

        // Validate type
        const type = txn.type === "credit" || txn.type === "debit" ? txn.type : "debit";

        return {
            ...txn,
            date,
            amount,
            type,
            description: txn.description?.trim() || 'Unknown'
        };
    });

    // Deduplicate (include type to avoid treating credit/debit as duplicates)
    const seen = new Set<string>();
    const deduplicated = processed.filter((txn) => {
        const key = `${txn.date}-${txn.amount}-${txn.description}-${txn.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`  Removed ${processed.length - deduplicated.length} duplicates`);
    console.log(`✅ Final count: ${deduplicated.length} transactions`);

    return deduplicated;
};

/**
 * Calculate confidence score
 */
const calculateConfidence = (extracted: number, pageCount: number): number => {
    // Base confidence for vision API
    let confidence = 0.90;

    // Adjust based on extraction density
    const avgPerPage = extracted / pageCount;
    if (avgPerPage < 1) {
        confidence *= 0.7; // Very few transactions
    } else if (avgPerPage < 3) {
        confidence *= 0.85; // Low density
    }

    return Math.min(confidence, 1.0);
};
