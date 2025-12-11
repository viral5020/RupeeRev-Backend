/**
 * Type definitions for GPay PDF extraction system
 */

export interface GPayTransaction {
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM AM/PM
    description: string;
    transaction_id?: string;
    account?: string;
    amount: number;
    type: 'debit' | 'credit';
    raw: string;
}

export interface PDFExtractionResult {
    rawText: string;
    method: 'pdf-parse' | 'ocr';
    pageCount: number;
}

export interface CleanedText {
    text: string;
    transactionCount: number;
}

export interface ExtractionResult {
    transactions: GPayTransaction[];
    method: 'pdf-parse' | 'ocr' | 'vision';
    confidence: number;
}
