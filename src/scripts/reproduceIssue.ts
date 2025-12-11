
import { normalizeText } from '../services/textNormalizer';
import { parseTransactionsWithRegex } from '../services/regexTransactionParser';

const runTest = () => {
    console.log('🧪 Starting Reproduction Test...');

    // Scenario 1: The user's specific case (110 vs 7930)
    // Constructing a line based on user snippet and typical format
    const userCaseRaw = `
VIRAL NILESH AJUDIYA
30-11-2025 UPI/HARSH UPADHYAY /570064413612/UPIUPI- UPI-123456789 110.00(Dr) 7,930.00(Cr)
    `;

    console.log('\n📝 Scenario 1: User Reported Case (110 vs 7930)');
    console.log(userCaseRaw.trim());

    const normalized1 = normalizeText(userCaseRaw);
    console.log(`\n🧹 Normalized: ${normalized1}`);

    const transactions1 = parseTransactionsWithRegex(normalized1);
    console.log(`\n📊 Extracted: ${transactions1.length}`);
    transactions1.forEach((t, i) => {
        console.log(`${i + 1}. ${t.date} | ${t.narration} | Amt: ${t.amount} (${t.debit_credit}) | Bal: ${t.balance}`);
        if (t.amount === 7930) {
            console.log('❌ ERROR: Extracted 7930 as amount instead of 110!');
        } else if (t.amount === 110) {
            console.log('✅ SUCCESS: Correctly extracted 110 as amount.');
        }
    });

    // Scenario 2: Date Format Mismatch
    // Pattern 1 expects DD-MM-YYYY, but Normalizer converts to YYYY-MM-DD
    const pattern1Case = `
01-09-2025 UPI/TEST/TRANSACTION/123 REF123456 500.00(Dr) 1000.00(Cr)
    `;
    console.log('\n\n📝 Scenario 2: Date Format & Pattern 1');
    console.log(pattern1Case.trim());

    const normalized2 = normalizeText(pattern1Case);
    console.log(`\n🧹 Normalized: ${normalized2}`);
    // Check if date was converted
    if (normalized2.includes('2025-09-01')) {
        console.log('⚠️ Note: Date converted to YYYY-MM-DD');
    }

    const transactions2 = parseTransactionsWithRegex(normalized2);
    console.log(`\n📊 Extracted: ${transactions2.length}`);
    transactions2.forEach((t, i) => {
        console.log(`${i + 1}. ${t.date} | ${t.narration} | Amt: ${t.amount} | Bal: ${t.balance}`);
        // Check if RefNo is in narration (indicating Pattern 3 usage)
        if (t.narration.includes('REF123456')) {
            console.log('⚠️ Warning: RefNo included in narration (Pattern 3 used instead of Pattern 1)');
        }
    });

    // Scenario 3: User's Exact Example from Chat
    const userExample2 = `
01-08-2025 UPI/NEFT/Ram Card/54321 UPI54321234567 75.00(Dr) 601.54(Cr)
    `;
    console.log('\n\n📝 Scenario 3: User Specific Example (75.00 vs 601.54)');
    console.log(userExample2.trim());

    const normalized3 = normalizeText(userExample2);
    const transactions3 = parseTransactionsWithRegex(normalized3);
    console.log(`\n📊 Extracted: ${transactions3.length}`);
    transactions3.forEach((t, i) => {
        console.log(`${i + 1}. ${t.date} | ${t.narration} | Amt: ${t.amount} (${t.debit_credit}) | Bal: ${t.balance}`);
        if (t.amount === 75.00) {
            console.log('✅ SUCCESS: Correctly extracted 75.00 as amount.');
        } else if (t.amount === 601.54) {
            console.log('❌ ERROR: Extracted 601.54 (Balance) as Amount!');
        } else {
            console.log(`❌ ERROR: Extracted unexpected amount: ${t.amount}`);
        }
    });

    // Scenario 4: User's New Example (110 vs 7820)
    // "UPI/HARSH UPADHYAY /533483782980/UPIUPI- food • kotak -₹7,820 Nov 30, 2025 fromPDF"
    // Reconstructing raw line assumption:
    const userExample3 = `
30-11-2025 UPI/HARSH UPADHYAY /533483782980/UPIUPI- 110.00(Dr) 7,820.00(Cr)
    `;
    console.log('\n\n📝 Scenario 4: User New Example (110 vs 7820)');
    console.log(userExample3.trim());

    const normalized4 = normalizeText(userExample3);
    const transactions4 = parseTransactionsWithRegex(normalized4);
    console.log(`\n📊 Extracted: ${transactions4.length}`);
    transactions4.forEach((t, i) => {
        console.log(`${i + 1}. ${t.date} | ${t.narration} | Amt: ${t.amount} (${t.debit_credit}) | Bal: ${t.balance}`);
        if (t.amount === 110.00) {
            console.log('✅ SUCCESS: Correctly extracted 110.00 as amount.');
        } else if (t.amount === 7820.00) {
            console.log('❌ ERROR: Extracted 7820.00 (Balance) as Amount!');
        } else {
            console.log(`❌ ERROR: Extracted unexpected amount: ${t.amount}`);
        }
    });
};

runTest();
