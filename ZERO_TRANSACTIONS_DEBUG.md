# 🐛 Zero Transactions - Debugging Steps

## Quick Debug

Run this command to see exactly what's being extracted:

```bash
# 1. Copy your PDF to backend folder and rename it
copy "C:\path\to\your\kotak-statement.pdf" "C:\Users\admin\Desktop\money manager\backend\test-statement.pdf"

# 2. Run debug script
cd "C:\Users\admin\Desktop\money manager\backend"
npx ts-node src/scripts/debugPdfExtraction.ts
```

## What the Debug Script Shows

It will display:
1. ✅ Raw text extracted from PDF
2. ✅ Normalized text
3. ✅ Sample lines (first 20)
4. ✅ Transactions found (if any)
5. ✅ Saves full text to `debug-extracted-text.txt`

## Common Issues

### Issue 1: PDF is Image-Based (Scanned)
**Symptoms:** Text extraction shows gibberish or very few characters

**Solution:** OCR should kick in automatically. Check console for:
```
Direct PDF extraction yielded low quality text. Triggering OCR fallback...
```

### Issue 2: Regex Patterns Don't Match
**Symptoms:** Text extracts fine but 0 transactions found

**Solution:** The debug script will show the actual line format. Share the "SAMPLE LINES" output with me and I'll create a custom regex pattern for your exact format.

### Issue 3: PDF is Encrypted/Password Protected
**Symptoms:** Error during PDF reading

**Solution:** Remove password protection from PDF first

### Issue 4: Wrong Date Format
**Symptoms:** Transactions extracted but validation fails

**Check:** Look at the extracted transactions' date format

## Share This With Me

After running the debug script, share:

1. **Console output** - Especially the "SAMPLE LINES" section
2. **Number of characters extracted** - Should be > 1000 for a typical statement
3. **Any error messages**

Example of what I need to see:
```
📋 SAMPLE LINES (first 20 lines):
------------------------------------------------------------
1: Date Narration Cheque No Withdrawal(Dr) Deposit(Cr) Balance
2: 01-08-2025 UPI/NEFT/Ram Card/54321 UPI54321234567 75.00(Dr) 601.54(Cr)
3: 02-08-2025 UPI/Merchant Payment UPI98765432109 24.00(Dr) 1,474.80(Cr)
...
```

## Alternative: Manual Pattern Creation

If you can share a few sample lines from your PDF (with sensitive info removed), I can create a custom regex pattern specifically for your bank's format.

Example:
```
01-08-2025 UPI/NEFT/Ram Card/XXXXX UPIXXXXXXXXX 75.00(Dr) 601.54(Cr)
02-08-2025 UPI/Merchant Payment UPIXXXXXXXXX 24.00(Dr) 1,474.80(Cr)
```

Just replace account numbers and names with X's and share the format.
