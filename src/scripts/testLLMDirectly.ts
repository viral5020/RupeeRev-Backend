import { extractGPayTransactionsWithAI } from "../services/gpay/gpayLLMExtractor";
import dotenv from "dotenv";

dotenv.config();

const testLLM = async () => {
    console.log("🧪 Testing LLM Extraction Directly");

    const sampleText = `
    Google Pay
    Transaction History
    
    Paid to
    Zomato
    ₹250.00
    Debited from HDFC Bank **** 1234
    UPI Transaction ID: 123456789012
    Aug 15, 2024, 1:30 PM
    
    Received from
    Amit Kumar
    ₹500.00
    Credited to HDFC Bank **** 1234
    UPI Transaction ID: 098765432109
    Aug 16, 2024, 10:00 AM
    `;

    try {
        const transactions = await extractGPayTransactionsWithAI(sampleText);
        console.log("Result:", JSON.stringify(transactions, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
};

testLLM();
