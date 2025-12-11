import { CleanedText } from './types';

/**
 * Layer 2: GPay Text Cleaner
 * Cleans and normalizes OCR output for GPay statements
 */

export const cleanGPayText = (rawText: string): CleanedText => {
    console.log('🧹 Starting GPay text cleaning...');

    let text = rawText;

    // Step 1: Remove duplicate lines
    const lines = text.split('\n');
    const uniqueLines = [...new Set(lines)];
    text = uniqueLines.join('\n');
    console.log(`  Removed ${lines.length - uniqueLines.length} duplicate lines`);

    // Step 2: Fix broken words (common OCR errors)
    text = text.replace(/P\s*a\s*i\s*d\s+t\s*o/gi, 'Paid to');
    text = text.replace(/R\s*e\s*c\s*e\s*i\s*v\s*e\s*d\s+f\s*r\s*o\s*m/gi, 'Received from');
    text = text.replace(/U\s*P\s*I/gi, 'UPI');
    text = text.replace(/C\s*o\s*m\s*p\s*l\s*e\s*t\s*e\s*d/gi, 'Completed');
    text = text.replace(/G\s*o\s*o\s*g\s*l\s*e\s+P\s*a\s*y/gi, 'Google Pay');

    // Step 3: Normalize amount formats
    // ₹23,000.00 → 23000 (we'll keep the ₹ for now, remove in LLM)
    text = text.replace(/₹\s*/g, '₹'); // Remove spaces after ₹
    text = text.replace(/Rs\.?\s*/gi, '₹'); // Convert Rs to ₹

    // Step 4: Normalize date formats (keep various formats, LLM will handle)
    // Just ensure consistency in spacing
    text = text.replace(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+(\d{4})/gi, '$1 $2 $3');

    // Step 5: Remove irrelevant text
    const noisePhrases = [
        /scratch\s+card/gi,
        /cashback\s+reward/gi,
        /try\s+adding\s+bank\s+account/gi,
        /google\s+pay\s+settings/gi,
        /scan\s+qr/gi,
        /summary/gi,
        /reward\s+unlocked/gi,
        /cashback\s+pending/gi,
        /add\s+money/gi,
        /invite\s+friends/gi,
        /refer\s+and\s+earn/gi
    ];

    noisePhrases.forEach(phrase => {
        text = text.replace(phrase, '');
    });

    // Step 6: Merge broken lines (transaction details often span multiple lines)
    // Look for patterns like:
    // Paid to
    // Merchant Name
    // ₹500
    // Completed
    // Merge these into single lines for easier parsing

    const mergedLines: string[] = [];
    const textLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let i = 0;
    while (i < textLines.length) {
        const line = textLines[i];

        // Check if this is a transaction start
        if (line.match(/^(Paid to|Received from|Sent to)/i)) {
            let transactionBlock = line;

            // Collect next few lines that are part of this transaction
            let j = i + 1;
            while (j < textLines.length && j < i + 6) { // Look ahead max 6 lines
                const nextLine = textLines[j];

                // Stop if we hit another transaction
                if (nextLine.match(/^(Paid to|Received from|Sent to)/i)) {
                    break;
                }

                transactionBlock += ' | ' + nextLine;
                j++;
            }

            mergedLines.push(transactionBlock);
            i = j;
        } else {
            mergedLines.push(line);
            i++;
        }
    }

    text = mergedLines.join('\n');

    // Step 7: Count potential transactions
    const transactionCount = (text.match(/(Paid to|Received from|Sent to)/gi) || []).length;

    console.log(`✅ Text cleaned: ${transactionCount} potential transactions found`);

    return {
        text,
        transactionCount
    };
};
