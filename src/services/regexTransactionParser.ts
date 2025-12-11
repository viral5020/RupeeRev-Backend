/**
 * Regex-based transaction parser for bank statements
 * More reliable than LLM for structured data
 */

export interface ParsedTransaction {
    date: string;
    narration: string;
    amount: number;
    debit_credit: 'Dr' | 'Cr';
    balance: number | null;
    raw: string;
    confidence: number;
}

/**
 * Parse bank statement text using regex patterns
 * Supports common Indian bank formats (Kotak, HDFC, ICICI, SBI, etc.)
 */
export const parseTransactionsWithRegex = (text: string): ParsedTransaction[] => {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split('\n');

    console.log(`\n🔍 Regex Parser: Processing ${lines.length} lines...`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.length < 20) continue;

        // Pattern 1: DD-MM-YYYY format with Dr/Cr indicators
        // Example: 01-08-2025 UPI/NEFT/Ram Card/54321 UPI54321234567 75.00(Dr) 601.54(Cr)
        const pattern1 = /(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([A-Z0-9-]+)\s+([\d,]+\.?\d*)\s*\(?(Dr|Cr)\)?\s+([\d,]+\.?\d*)\s*\(?(Dr|Cr)\)?/i;
        const match1 = line.match(pattern1);

        if (match1) {
            const [, dateStr, narration, refNo, amount1, type1, amount2, type2] = match1;

            // Determine which is transaction amount and which is balance
            const isFirstDebit = type1.toLowerCase() === 'dr';
            const transactionAmount = parseFloat(amount1.replace(/,/g, ''));
            const balanceAmount = parseFloat(amount2.replace(/,/g, ''));

            transactions.push({
                date: convertDateToISO(dateStr),
                narration: narration.trim(),
                amount: transactionAmount,
                debit_credit: isFirstDebit ? 'Dr' : 'Cr',
                balance: balanceAmount,
                raw: line,
                confidence: 0.95
            });
            continue;
        }

        // Pattern 2: Simpler format - Date Narration Amount Balance
        // Example: 01-08-2025 UPI Payment to Merchant 500.00 10000.00
        const pattern2 = /(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s*\(?(?:Dr|Cr)?\)?\s+([\d,]+\.?\d*)\s*\(?(?:Dr|Cr)?\)?/;
        const match2 = line.match(pattern2);

        if (match2) {
            const [, dateStr, narration, amountStr, balanceStr] = match2;
            const amount = parseFloat(amountStr.replace(/,/g, ''));
            const balance = parseFloat(balanceStr.replace(/,/g, ''));

            // Heuristic: if narration contains withdrawal/debit keywords, it's Dr
            const isDebit = /debit|withdrawal|payment|transfer|upi.*to/i.test(narration);

            transactions.push({
                date: convertDateToISO(dateStr),
                narration: narration.trim(),
                amount: amount,
                debit_credit: isDebit ? 'Dr' : 'Cr',
                balance: balance,
                raw: line,
                confidence: 0.85
            });
            continue;
        }

        // Pattern 3: YYYY-MM-DD format
        const pattern3 = /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([\d,]+\.?\d*)\s*\(?(Dr|Cr)\)?\s+([\d,]+\.?\d*)/i;
        const match3 = line.match(pattern3);

        if (match3) {
            const [, dateStr, narration, amountStr, type, balanceStr] = match3;

            transactions.push({
                date: dateStr,
                narration: narration.trim(),
                amount: parseFloat(amountStr.replace(/,/g, '')),
                debit_credit: type.toLowerCase() === 'dr' ? 'Dr' : 'Cr',
                balance: parseFloat(balanceStr.replace(/,/g, '')),
                raw: line,
                confidence: 0.95
            });
            continue;
        }

        // Pattern 4: UPI-specific format
        // Example: UPI/P2A/123456789/user@bank/Merchant Name 500.00 Dr
        const pattern4 = /(UPI|NEFT|IMPS|RTGS)\/(.+?)\s+([\d,]+\.?\d*)\s*(Dr|Cr)?/i;
        const match4 = line.match(pattern4);

        if (match4 && i > 0) {
            // Try to find date in previous line
            const prevLine = lines[i - 1];
            const dateMatch = prevLine.match(/(\d{2}-\d{2}-\d{4})/);

            if (dateMatch) {
                const [, , narration, amountStr, type] = match4;

                transactions.push({
                    date: convertDateToISO(dateMatch[1]),
                    narration: match4[0],
                    amount: parseFloat(amountStr.replace(/,/g, '')),
                    debit_credit: type ? (type.toLowerCase() === 'dr' ? 'Dr' : 'Cr') : 'Dr',
                    balance: null,
                    raw: `${prevLine} ${line}`,
                    confidence: 0.75
                });
            }
        }
    }

    console.log(`✅ Regex Parser: Extracted ${transactions.length} transactions`);
    if (transactions.length > 0) {
        console.log(`   Sample: ${transactions[0].date} - ${transactions[0].narration} - ₹${transactions[0].amount}`);
    }

    return transactions;
};

/**
 * Convert DD-MM-YYYY to YYYY-MM-DD
 */
function convertDateToISO(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        if (year.length === 4) {
            return `${year}-${month}-${day}`;
        }
    }
    return dateStr;
}
