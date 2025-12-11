import axios from "axios";
import dotenv from "dotenv";
import { GPayTransaction } from "./types";
import { createCanvas } from "canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.js";

dotenv.config();

const API_KEY = process.env.VITE_LLM_API_KEY;
const API_ENDPOINT = process.env.VITE_LLM_API_ENDPOINT;

/**
 * Convert PDF page to base64 PNG image
 */
const pdfPageToBase64 = async (pdfBuffer: Buffer, pageNumber: number): Promise<string> => {
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNumber);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    await page.render({ canvasContext: context, viewport }).promise;

    // Convert to base64 PNG
    const buffer = canvas.toBuffer("image/png");
    return buffer.toString("base64");
};

/**
 * Extract transactions from ALL PDF pages using a single Gemini Vision request
 */
const extractFromPages = async (base64Images: string[]): Promise<GPayTransaction[]> => {
    const prompt = `
### Role
You are a **Programmatic Data Extraction Engine** specialized in processing Google Pay statement images for automated pipeline ingestion. Your output must be immediately consumable by a Node.js 'JSON.parse()' function.

### Task
Analyze the provided Google Pay statement page images. These images represent a single document. Identify every distinct, valid transaction event across ALL pages and extract the required fields.

### Output Format
Return a SINGLE, valid JSON array of objects containing transactions from ALL pages. **NO leading or trailing text, introductions, explanations, or JSON formatting fences**.

**JSON Schema:**
[
    {
        "date": "YYYY-MM-DD",
        "time": "HH:MM AM/PM",
        "description": "String (The name of the payee or payer, e.g., 'IRCTC_APP_UPI' or 'Harsh Upadhyay')",
        "transaction_id": "String (The unique UPI Transaction ID)",
        "account": "String (The associated bank account, e.g., 'Kotak Mahindra Bank 0938')",
        "amount": "Number (float)",
        "type": "credit" | "debit" (Use 'debit' for 'Paid to', use 'credit' for 'Received from'),
        "raw": "String (The full, raw text corresponding to this specific transaction)"
    }
]

### Reasoning Steps
1. **Block Identification:** Scan all images to segment content into distinct transaction blocks. Ignore non-transactional text.
2. **Field Isolation:** For each block, isolate: Date, Time, Transaction ID, Amount, Description, and Bank/Account details.
3. **Type Classification:** Based on keywords ('Paid to' or 'Received from'), assign 'type' as "debit" or "credit".
4. **Date Conversion:** Convert date string (e.g., "30 Nov, 2025") into "YYYY-MM-DD" format.
5. **Schema Mapping:** Map extracted data to JSON schema, ensuring 'amount' is a Number.

### Strict Constraints
* **JSON Purity (CRITICAL):** Response must BEGIN with '[' and END with ']'. Any deviation will cause parsing to fail.
* **No Hallucination:** If a field cannot be found, set its value to null. Do not guess or invent data.
* **Exclusion:** Exclude non-transactional items (e.g., balance checks, failed transactions).

Analyze the images and return the JSON array:
`;

    try {
        console.log(`📸 Processing ${base64Images.length} pages with Gemini Vision (Single Request)...`);

        // Construct parts payload: 1 text part + N image parts
        const parts: any[] = [{ text: prompt }];

        base64Images.forEach(img => {
            parts.push({
                inline_data: {
                    mime_type: "image/png",
                    data: img
                }
            });
        });

        const response = await axios.post(
            `${API_ENDPOINT}?key=${API_KEY}`,
            {
                contents: [
                    {
                        parts: parts
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 65536
                }
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.warn(`⚠️ Gemini returned no text for the document`);
            console.log("🔍 Raw Response:", JSON.stringify(response.data, null, 2));
            return [];
        }

        console.log(`📤 Gemini response (first 200 chars): ${generatedText.substring(0, 200)}...`);

        // Clean JSON response
        const cleanJson = generatedText.replace(/```json|```/g, "").trim();

        let transactions: GPayTransaction[] = [];
        try {
            transactions = JSON.parse(cleanJson);
            console.log(`✅ Extracted ${transactions.length} transactions from ${base64Images.length} pages`);
        } catch (err) {
            console.error(`❌ JSON parse failed:`, err);
            console.log("Raw response:", generatedText);
            return [];
        }

        return transactions;
    } catch (error: any) {
        console.error(`❌ Vision API failed:`, error.message);
        if (error.response) console.error("API Error:", error.response.data);
        return [];
    }
};

/**
 * Main function: Extract all transactions from PDF using Gemini Vision
 */
export const extractGPayTransactionsWithVision = async (
    pdfBuffer: Buffer
): Promise<{ transactions: GPayTransaction[]; pageCount: number }> => {
    if (!API_KEY) {
        throw new Error("VITE_LLM_API_KEY is not defined");
    }

    console.log("🤖 Starting Gemini Vision extraction (Single Request Mode)...");

    // Get page count
    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    console.log(`📄 PDF has ${pageCount} pages`);

    // 1. Convert ALL pages to Base64 (Parallel is fine here as it's local processing)
    const imagePromises = Array.from({ length: pageCount }, async (_, index) => {
        const pageNum = index + 1;
        return await pdfPageToBase64(pdfBuffer, pageNum);
    });

    const base64Images = await Promise.all(imagePromises);

    // 2. Process in batches of 5 (One API request per batch)
    const BATCH_SIZE = 5;
    const allTransactions: GPayTransaction[] = [];

    for (let i = 0; i < pageCount; i += BATCH_SIZE) {
        const batchImages = base64Images.slice(i, i + BATCH_SIZE);
        const startPage = i + 1;
        const endPage = Math.min(i + BATCH_SIZE, pageCount);

        console.log(`🚀 Processing batch ${Math.ceil((i + 1) / BATCH_SIZE)}: Pages ${startPage} to ${endPage} (${batchImages.length} images)...`);

        const batchTransactions = await extractFromPages(batchImages);
        allTransactions.push(...batchTransactions);

        // Add delay between batches to respect rate limits (not after the last batch)
        if (i + BATCH_SIZE < pageCount) {
            console.log("⏳ Waiting 5 seconds to respect API rate limits...");
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log(`✅ Total transactions extracted: ${allTransactions.length}`);

    return {
        transactions: allTransactions,
        pageCount
    };
};
