import axios from "axios";
import dotenv from "dotenv";
import { GPayTransaction } from "./types";

dotenv.config();

const API_KEY = process.env.VITE_LLM_API_KEY;

const API_ENDPOINT =
    process.env.VITE_LLM_API_ENDPOINT;

/**
 * Layer 3: AI Transaction Extractor
 */
export const extractGPayTransactionsWithAI = async (
    cleanText: string
): Promise<GPayTransaction[]> => {
    if (!API_KEY) {
        throw new Error("VITE_LLM_API_KEY is not defined");
    }

    console.log("🤖 Starting AI transaction extraction...");

    const prompt = `
### ROLE
You are a **Programmatic Data Extraction Engine**, **Financial Transaction Parser**, and **Category Classifier**.
You convert raw OCR text from Google Pay PDF statements into structured JSON — 100% valid, machine-readable, no hallucination.

### GOAL
Extract **ONLY valid money transactions** and return them as a **pure JSON array** following the schema below.

### REQUIRED OUTPUT
[
  {
    "date": "YYYY-MM-DD",
    "time": "HH:MM AM/PM",
    "description": "string",
    "transaction_id": "string|null",
    "account": "string|null",
    "amount": number,
    "type": "credit" | "debit",
    "category": "string",
    "raw": "Full raw text block"
  }
]

### CATEGORY RULES
(… full category section …)

### EXTRACTION RULES 
(… full rules from above …)

### TEXT TO ANALYZE:
${cleanText}
`;

    try {
        const response = await axios.post(
            `${API_ENDPOINT}?key=${API_KEY}`,
            {
                model: "models/gemini-2.5-flash-lite",
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 65536,
                },
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const generatedText =
            response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!generatedText) {
            console.warn("⚠️ LLM returned no text");
            return [];
        }

        // Ensure we remove any markdown (rare)
        const cleanJson = generatedText
            .replace(/```json|```/g, "")
            .trim();

        let transactions: GPayTransaction[] = [];
        try {
            transactions = JSON.parse(cleanJson);
        } catch (err) {
            console.error("❌ JSON parse failed:", err);
            console.log("LLM Output:", cleanJson);
            return [];
        }

        console.log(`✅ AI extracted ${transactions.length} transactions`);
        return postProcessTransactions(transactions);
    } catch (error: any) {
        console.error("❌ AI extraction failed:", error.message);
        if (error.response) console.error("API Error:", error.response.data);
        return [];
    }
};


/**
 * Post-processing:
 * - Fix OCR mistakes
 * - Normalize date
 * - Deduplicate
 */
const postProcessTransactions = (
    transactions: GPayTransaction[]
): GPayTransaction[] => {
    console.log("🔧 Post-processing transactions...");

    const processed = transactions.map((txn) => {
        // Fix OCR numeric issues
        let amountStr = String(txn.amount)
            .replace(/O/g, "0")
            .replace(/[lI|]/g, "1")
            .replace(/[^0-9.]/g, "");

        const amount = parseFloat(amountStr) || 0;

        // Fix date format
        let date = txn.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const parsed = new Date(date);
            date = !isNaN(parsed.getTime())
                ? parsed.toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0];
        }

        const type =
            txn.type === "credit" || txn.type === "debit" ? txn.type : "debit";

        return {
            ...txn,
            amount,
            date,
            type,
            description: txn.description?.trim() || "",
        };
    });

    // Deduplication
    const seen = new Set<string>();
    const deduplicated = processed.filter((txn) => {
        const key = `${txn.date}-${txn.amount}-${txn.description}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(
        `  Removed ${processed.length - deduplicated.length} duplicates`
    );
    console.log(`✅ Final count: ${deduplicated.length}`);

    return deduplicated;
};
