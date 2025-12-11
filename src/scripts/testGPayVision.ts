import { processGPayPDF } from "../services/gpay";
import { promises as fs } from "fs";
import path from "path";

/**
 * Test script for GPay Vision API extraction
 * Usage: npx ts-node src/scripts/testGPayVision.ts <path-to-gpay-pdf>
 */

const testGPayVision = async () => {
    console.log("🧪 Testing GPay Vision API Extraction\n");

    const pdfPath = process.argv[2];

    if (!pdfPath) {
        console.error("❌ Please provide a PDF path");
        console.log("Usage: npx ts-node src/scripts/testGPayVision.ts <path-to-gpay-pdf>");
        process.exit(1);
    }

    try {
        const pdfBuffer = await fs.readFile(pdfPath);
        console.log(`📄 Loaded PDF: ${path.basename(pdfPath)} (${pdfBuffer.length} bytes)\n`);

        const result = await processGPayPDF(pdfBuffer);

        console.log("\n📊 EXTRACTION RESULTS:");
        console.log(`  Method: ${result.method}`);
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        console.log(`  Transactions: ${result.transactions.length}\n`);

        if (result.transactions.length > 0) {
            console.log("💰 TRANSACTIONS:\n");
            result.transactions.forEach((txn, i) => {
                console.log(`${i + 1}. ${txn.date} ${txn.time || ""} | ${txn.type.toUpperCase()} | ₹${txn.amount}`);
                console.log(`   ${txn.description}`);
                if (txn.transaction_id) console.log(`   TxnID: ${txn.transaction_id}`);
                if (txn.account) console.log(`   Account: ${txn.account}`);
                console.log("");
            });
        } else {
            console.log("⚠️ No transactions extracted");
        }

        console.log("✅ Test complete!");
    } catch (error: any) {
        console.error("❌ Test failed:", error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
};

testGPayVision();
