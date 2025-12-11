import axios from 'axios';
import { TextChunk } from './chunker';

const API_ENDPOINT = process.env.VITE_LLM_API_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const API_KEY = process.env.VITE_LLM_API_KEY;

export interface ExtractedTransaction {
    date: string;
    narration: string;
    amount: number;
    debit_credit: 'Dr' | 'Cr';
    balance: number | null;
    raw: string;
    confidence: number;
}

export interface LLMResponse {
    chunkId: string;
    transactions: ExtractedTransaction[];
}

export const extractTransactionsFromChunk = async (chunk: TextChunk): Promise<LLMResponse> => {
    if (!API_KEY) {
        throw new Error('VITE_LLM_API_KEY is not defined');
    }

    const prompt = `You are a financial data extraction AI specialized in parsing bank statements.

TASK: Extract ALL transactions from the bank statement text below.

IMPORTANT RULES:
1. Look for transaction patterns with Date, Narration/Description, Amount, and Balance
2. Common formats include:
   - DD-MM-YYYY or YYYY-MM-DD dates
   - UPI transactions (UPI/NEFT/IMPS/RTGS)
   - Debit amounts are withdrawals (use "Dr")
   - Credit amounts are deposits (use "Cr")
3. Extract EVERY transaction line you find
4. If you see "Withdrawal" or money going out, it's "Dr" (Debit)
5. If you see "Deposit" or money coming in, it's "Cr" (Credit)
6. Set confidence to 0.9 if you're sure, 0.7 if somewhat sure, 0.5 if uncertain

EXAMPLE INPUT:
01-08-2025 UPI/NEFT/Ram Card/54321 UPI54321234567 75.00(Dr) 601.54(Cr)

EXAMPLE OUTPUT:
{
  "date": "2025-08-01",
  "narration": "UPI/NEFT/Ram Card/54321",
  "amount": 75.00,
  "debit_credit": "Dr",
  "balance": 601.54,
  "raw": "01-08-2025 UPI/NEFT/Ram Card/54321 UPI54321234567 75.00(Dr) 601.54(Cr)",
  "confidence": 0.9
}

OUTPUT FORMAT (JSON only, no markdown):
{
  "chunkId": "${chunk.chunkId}",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "narration": "transaction description",
      "amount": number,
      "debit_credit": "Dr" or "Cr",
      "balance": number or null,
      "raw": "original line",
      "confidence": 0.0 to 1.0
    }
  ]
}

If NO transactions found, return: { "chunkId": "${chunk.chunkId}", "transactions": [] }

TEXT TO ANALYZE:
${chunk.text}

RESPOND WITH JSON ONLY (no markdown, no code blocks):`;

    try {
        console.log(`\n🤖 Calling Gemini API for chunk ${chunk.chunkIndex}...`);
        console.log(`📝 Chunk preview (first 200 chars): ${chunk.text.substring(0, 200)}...`);

        const response = await axios.post(
            `${API_ENDPOINT}?key=${API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 65536,
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.warn(`⚠️ LLM returned no text for chunk ${chunk.chunkId}`);
            console.log('Full response:', JSON.stringify(response.data, null, 2));
            return { chunkId: chunk.chunkId, transactions: [] };
        }

        console.log(`📤 LLM Response (first 300 chars): ${generatedText.substring(0, 300)}...`);

        // Clean up markdown code blocks if present
        let cleanJson = generatedText.trim();
        cleanJson = cleanJson.replace(/```json\s*/g, '');
        cleanJson = cleanJson.replace(/```\s*/g, '');
        cleanJson = cleanJson.trim();

        try {
            const parsed: LLMResponse = JSON.parse(cleanJson);
            console.log(`✅ Successfully parsed ${parsed.transactions.length} transactions from chunk ${chunk.chunkIndex}`);

            if (parsed.transactions.length > 0) {
                console.log(`   Sample transaction: ${parsed.transactions[0].date} - ${parsed.transactions[0].narration} - ₹${parsed.transactions[0].amount}`);
            }

            return parsed;
        } catch (parseError) {
            console.error(`❌ Failed to parse LLM response for chunk ${chunk.chunkId}`);
            console.error('Parse error:', parseError);
            console.error('Raw LLM response:', generatedText);
            console.error('Cleaned JSON attempt:', cleanJson);
            return { chunkId: chunk.chunkId, transactions: [] };
        }

    } catch (error: any) {
        console.error(`❌ Error calling LLM for chunk ${chunk.chunkId}:`, error.message);
        if (error.response) {
            console.error('API Error Response:', error.response.data);
        }
        return { chunkId: chunk.chunkId, transactions: [] };
    }
};
