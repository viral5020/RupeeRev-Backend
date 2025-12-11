/**
 * Debug script to test PDF extraction and see what's happening
 * 
 * Usage:
 *   1. Place your PDF in backend folder as 'test-statement.pdf'
 *   2. Run: npx ts-node src/scripts/debugPdfExtraction.ts
 */

import { extractTextFromPDF } from '../services/pdfTextExtractor';
import { normalizeText } from '../services/textNormalizer';
import { parseTransactionsWithRegex } from '../services/regexTransactionParser';
import { promises as fs } from 'fs';
import path from 'path';

const PDF_PATH = path.join(__dirname, '../../test-statement.pdf');

async function debugExtraction() {
    try {
        console.log('🔍 DEBUG: PDF Extraction Test\n');
        console.log('='.repeat(60));

        // Read PDF
        console.log(`📄 Reading PDF: ${PDF_PATH}`);
        const pdfBuffer = await fs.readFile(PDF_PATH);
        console.log(`✅ PDF loaded: ${pdfBuffer.length} bytes\n`);

        // Extract text
        console.log('📖 Step 1: Extracting text from PDF...');
        const rawText = await extractTextFromPDF(pdfBuffer);
        console.log(`✅ Extracted ${rawText.length} characters\n`);

        // Show first 1000 chars of raw text
        console.log('📝 RAW TEXT (first 1000 chars):');
        console.log('-'.repeat(60));
        console.log(rawText.substring(0, 1000));
        console.log('-'.repeat(60));
        console.log('\n');

        // Normalize
        console.log('🧹 Step 2: Normalizing text...');
        const normalizedText = normalizeText(rawText);
        console.log(`✅ Normalized to ${normalizedText.length} characters\n`);

        // Show first 1000 chars of normalized text
        console.log('📝 NORMALIZED TEXT (first 1000 chars):');
        console.log('-'.repeat(60));
        console.log(normalizedText.substring(0, 1000));
        console.log('-'.repeat(60));
        console.log('\n');

        // Show some sample lines
        console.log('📋 SAMPLE LINES (first 20 lines):');
        console.log('-'.repeat(60));
        const lines = normalizedText.split('\n').slice(0, 20);
        lines.forEach((line, idx) => {
            console.log(`${idx + 1}: ${line}`);
        });
        console.log('-'.repeat(60));
        console.log('\n');

        // Try regex parsing
        console.log('🎯 Step 3: Attempting regex extraction...');
        const transactions = parseTransactionsWithRegex(normalizedText);
        console.log(`✅ Found ${transactions.length} transactions\n`);

        if (transactions.length > 0) {
            console.log('📊 EXTRACTED TRANSACTIONS (first 10):');
            console.log('-'.repeat(60));
            transactions.slice(0, 10).forEach((txn, idx) => {
                console.log(`${idx + 1}. ${txn.date} | ${txn.debit_credit} | ₹${txn.amount}`);
                console.log(`   Narration: ${txn.narration}`);
                console.log(`   Balance: ${txn.balance}`);
                console.log(`   Confidence: ${txn.confidence}`);
                console.log(`   Raw: ${txn.raw.substring(0, 100)}...`);
                console.log('');
            });
            console.log('-'.repeat(60));
        } else {
            console.log('❌ NO TRANSACTIONS FOUND!');
            console.log('\nThis means the regex patterns don\'t match your PDF format.');
            console.log('Please share the "SAMPLE LINES" output above so I can create a custom pattern.\n');
        }

        // Save full text to file for inspection
        const debugFile = path.join(__dirname, '../../debug-extracted-text.txt');
        await fs.writeFile(debugFile, `RAW TEXT:\n${rawText}\n\n${'='.repeat(60)}\n\nNORMALIZED TEXT:\n${normalizedText}`);
        console.log(`\n💾 Full extracted text saved to: ${debugFile}`);
        console.log('You can inspect this file to see exactly what was extracted from the PDF.\n');

    } catch (error: any) {
        console.error('\n❌ ERROR:', error.message);
        if (error.code === 'ENOENT') {
            console.log(`\n📝 Please place your PDF at: ${PDF_PATH}`);
        }
    }
}

debugExtraction();
