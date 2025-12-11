import { processGPayPDF } from '../services/gpay';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Test script for GPay PDF extraction pipeline
 * Usage: npx ts-node backend/src/scripts/testGPayPipeline.ts <path-to-gpay-pdf>
 */

const testGPayPipeline = async () => {
    console.log('🧪 Testing GPay PDF Extraction Pipeline\n');

    // Get PDF path from command line or use default
    const pdfPath = process.argv[2];

    if (!pdfPath) {
        console.error('❌ Please provide a PDF path');
        console.log('Usage: npx ts-node backend/src/scripts/testGPayPipeline.ts <path-to-gpay-pdf>');
        process.exit(1);
    }

    try {
        // Read PDF file
        const pdfBuffer = await fs.readFile(pdfPath);
        console.log(`📄 Loaded PDF: ${path.basename(pdfPath)} (${pdfBuffer.length} bytes)\n`);

        // Process through pipeline
        const result = await processGPayPDF(pdfBuffer);

        // Display results
        console.log('\n📊 EXTRACTION RESULTS:');
        console.log(`  Method: ${result.method}`);
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        console.log(`  Transactions: ${result.transactions.length}\n`);

        if (result.transactions.length > 0) {
            console.log('💰 TRANSACTIONS:\n');
            result.transactions.forEach((txn, i) => {
                console.log(`${i + 1}. ${txn.date} | ${txn.type.toUpperCase()} | ₹${txn.amount}`);
                console.log(`   ${txn.description}`);
                console.log(`   ${(txn as any).payment_channel} | ${(txn as any).status}`);
                console.log('');
            });
        } else {
            console.log('⚠️ No transactions extracted');
        }

        console.log('✅ Test complete!');

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
};

testGPayPipeline();
