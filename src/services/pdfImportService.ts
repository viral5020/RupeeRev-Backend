import { extractTextFromPDF } from './pdfTextExtractor';
import { normalizeText } from './textNormalizer';
import { chunkText, TextChunk } from './chunker';
import { extractTransactionsFromChunk, ExtractedTransaction } from './llmTransactionExtractor';
import { parseTransactionsWithRegex, ParsedTransaction } from './regexTransactionParser';
import { mergeTransactions, MergedTransaction } from './transactionMerger';
import { validateTransactions, ValidatedTransaction } from './validator';
import Transaction from '../models/transaction';
import { promises as fs } from 'fs';

export interface PDFImportResult {
    totalTransactionsFound: number;
    highConfidenceCount: number;
    lowConfidenceCount: number;
    chunksParsed: number;
    timeTaken: number;
    preview: ValidatedTransaction[];
    savedCount: number;
    method: 'regex' | 'llm' | 'hybrid';
}

export const processPDFImport = async (
    pdfBuffer: Buffer,
    userId: string,
    pdfPath?: string
): Promise<PDFImportResult> => {
    const startTime = Date.now();

    console.log('📄 PDF uploaded');

    // Step 1: Extract text
    console.log('🔍 Extracting text from PDF...');
    const rawText = await extractTextFromPDF(pdfBuffer);
    console.log(`✅ Raw text extracted: ${rawText.length} chars`);

    // Step 2: Normalize text
    console.log('🧹 Normalizing text...');
    const normalizedText = normalizeText(rawText);
    console.log(`✅ Text normalized: ${normalizedText.length} chars`);

    // Step 3: Try REGEX parser first (faster and more reliable)
    console.log('🎯 Attempting regex-based extraction...');
    let allTransactions: (ExtractedTransaction | ParsedTransaction)[] = parseTransactionsWithRegex(normalizedText);
    let method: 'regex' | 'llm' | 'hybrid' = 'regex';
    let chunksParsed = 0;

    // Step 4: If regex found few/no transactions, try LLM as fallback
    if (allTransactions.length < 5) {
        console.log(`⚠️ Regex found only ${allTransactions.length} transactions. Trying LLM fallback...`);

        console.log('✂️ Chunking text...');
        const chunks = chunkText(normalizedText, 2000, 200);
        console.log(`✅ Chunked into ${chunks.length} chunks`);
        chunksParsed = chunks.length;

        console.log('🤖 Extracting transactions with LLM...');
        const llmTransactions: ExtractedTransaction[] = [];

        for (const chunk of chunks) {
            const result = await extractTransactionsFromChunk(chunk);
            llmTransactions.push(...result.transactions);
            console.log(`  Chunk ${chunk.chunkIndex}: ${result.transactions.length} transactions`);
        }

        console.log(`✅ LLM returned ${llmTransactions.length} transactions`);

        if (llmTransactions.length > allTransactions.length) {
            console.log(`✅ Using LLM results (${llmTransactions.length} vs ${allTransactions.length})`);
            allTransactions = llmTransactions;
            method = 'llm';
        } else if (allTransactions.length > 0 && llmTransactions.length > 0) {
            console.log(`✅ Combining regex and LLM results`);
            allTransactions = [...allTransactions, ...llmTransactions];
            method = 'hybrid';
        }
    } else {
        console.log(`✅ Regex extraction successful: ${allTransactions.length} transactions found`);
    }

    console.log(`\n📊 Total transactions extracted: ${allTransactions.length} (method: ${method})`);

    // Step 5: Merge and deduplicate
    console.log('🔀 Merging and categorizing transactions...');
    const mergedTransactions = await mergeTransactions(allTransactions, userId);
    console.log(`✅ Merged into final ${mergedTransactions.length} transactions`);

    // Step 6: Validate
    console.log('✔️ Validating transactions...');
    const validatedTransactions = validateTransactions(mergedTransactions);

    const highConfidence = validatedTransactions.filter(t => t.confidence >= 0.5 && t.validationResult.isValid);
    const lowConfidence = validatedTransactions.filter(t => t.confidence < 0.5 || !t.validationResult.isValid);

    console.log(`✅ High confidence: ${highConfidence.length}, Low confidence: ${lowConfidence.length}`);

    // Step 7: Save to DB (only high confidence valid transactions)
    console.log('💾 Saving to database...');
    let savedCount = 0;

    for (const txn of highConfidence) {
        try {
            await Transaction.create({
                user: userId,
                title: txn.narration.substring(0, 50), // Use first 50 chars as title
                amount: txn.amount,
                type: txn.debit_credit === 'Dr' ? 'expense' : 'income',
                category: txn.category || 'Uncategorized',
                date: new Date(txn.date),
                notes: `Imported from PDF. Raw: ${txn.raw}`,
                source: 'pdf',
                importedAt: new Date(),
            });
            savedCount++;
        } catch (error) {
            console.error(`Failed to save transaction:`, error);
        }
    }

    console.log(`✅ Saved ${savedCount} transactions to DB`);

    // Step 8: Auto-delete PDF
    if (pdfPath) {
        try {
            await fs.unlink(pdfPath);
            console.log('🗑️ Temporary PDF deleted');
        } catch (error) {
            console.error('Failed to delete PDF:', error);
        }
    }

    const timeTaken = Date.now() - startTime;
    console.log(`⏱️ Total time taken: ${timeTaken}ms`);

    return {
        totalTransactionsFound: allTransactions.length,
        highConfidenceCount: highConfidence.length,
        lowConfidenceCount: lowConfidence.length,
        chunksParsed,
        timeTaken,
        preview: validatedTransactions.slice(0, 10), // Return first 10 for preview
        savedCount,
        method
    };
};
