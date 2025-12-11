/**
 * Test script for PDF Import Pipeline
 * 
 * This script demonstrates how to test the PDF extraction pipeline
 * using a sample PDF file.
 * 
 * Usage:
 *   1. Place a sample bank statement PDF in the backend folder
 *   2. Update the PDF_PATH below
 *   3. Run: npx ts-node src/scripts/testPdfPipeline.ts
 */

import { processPDFImport } from '../services/pdfImportService';
import { promises as fs } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PDF_PATH = path.join(__dirname, '../../sample-statement.pdf'); // Update this path
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Use a valid user ID from your DB

async function testPdfPipeline() {
    try {
        console.log('🚀 Starting PDF Pipeline Test\n');

        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/money-manager');
        console.log('✅ Connected to MongoDB\n');

        // Check if PDF exists
        try {
            await fs.access(PDF_PATH);
            console.log(`📄 Found PDF: ${PDF_PATH}\n`);
        } catch (error) {
            console.error(`❌ PDF not found at: ${PDF_PATH}`);
            console.log('\nPlease update PDF_PATH in this script to point to a valid PDF file.');
            process.exit(1);
        }

        // Read PDF buffer
        console.log('📖 Reading PDF file...');
        const pdfBuffer = await fs.readFile(PDF_PATH);
        console.log(`✅ PDF loaded (${pdfBuffer.length} bytes)\n`);

        // Process PDF
        console.log('⚙️ Processing PDF through pipeline...\n');
        console.log('='.repeat(60));

        const result = await processPDFImport(pdfBuffer, TEST_USER_ID, PDF_PATH);

        console.log('='.repeat(60));
        console.log('\n📊 RESULTS:\n');
        console.log(`Total Transactions Found: ${result.totalTransactionsFound}`);
        console.log(`High Confidence: ${result.highConfidenceCount}`);
        console.log(`Low Confidence: ${result.lowConfidenceCount}`);
        console.log(`Chunks Parsed: ${result.chunksParsed}`);
        console.log(`Saved to DB: ${result.savedCount}`);
        console.log(`Time Taken: ${result.timeTaken}ms (${(result.timeTaken / 1000).toFixed(2)}s)`);

        console.log('\n📝 Preview (first 5 transactions):\n');
        result.preview.slice(0, 5).forEach((txn, idx) => {
            console.log(`${idx + 1}. ${txn.date} | ${txn.debit_credit} | ₹${txn.amount}`);
            console.log(`   ${txn.narration}`);
            console.log(`   Category: ${txn.categoryName || 'Uncategorized'}`);
            console.log(`   Confidence: ${(txn.confidence * 100).toFixed(0)}%`);
            console.log(`   Valid: ${txn.validationResult.isValid ? '✅' : '❌'}`);
            if (txn.validationResult.errors.length > 0) {
                console.log(`   Errors: ${txn.validationResult.errors.join(', ')}`);
            }
            console.log('');
        });

        console.log('✅ Test completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(error);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run the test
testPdfPipeline();
