# 🐛 Debugging Guide for PDF Import Issues

## Common Issues & Solutions

### Issue 1: Zero Transactions Extracted

**Symptoms:**
- API returns `totalTransactionsFound: 0`
- Console shows "LLM returned X transactions" but savedCount is 0

**Debugging Steps:**

1. **Check Console Logs** - Look for:
   ```
   🤖 Calling Gemini API for chunk...
   📝 Chunk preview (first 200 chars): ...
   📤 LLM Response (first 300 chars): ...
   ✅ Successfully parsed X transactions
   ```

2. **Verify API Key:**
   ```bash
   # In backend/.env
   VITE_LLM_API_KEY=your_key_here
   ```

3. **Check PDF Text Extraction:**
   - If you see "OCR fallback triggered" → PDF is image-based (normal)
   - If text length < 500 chars → PDF may be encrypted or corrupted

4. **Review LLM Response:**
   - Check console for "Raw LLM response"
   - If response is empty → API key issue or quota exceeded
   - If response has transactions but savedCount=0 → validation failing

### Issue 2: Low Confidence / Validation Failures

**Symptoms:**
- `lowConfidenceCount` is high
- Transactions not saved to DB

**Solutions:**

1. **Check Validation Errors:**
   Look in the `preview` array for `validationResult.errors`

2. **Common Validation Issues:**
   - **Invalid date format**: LLM didn't convert DD-MM-YYYY to YYYY-MM-DD
   - **Missing Dr/Cr**: Transaction type not detected
   - **Invalid amount**: Amount parsed as string or negative

3. **Fix:**
   - Adjust LLM prompt in `llmTransactionExtractor.ts`
   - Improve date normalization in `textNormalizer.ts`

### Issue 3: Duplicate Transactions

**Symptoms:**
- Same transaction appears multiple times

**Solution:**
- Check `transactionMerger.ts` deduplication logic
- Verify the unique key: `date_amount_narration`

### Issue 4: Wrong Categories

**Symptoms:**
- Transactions categorized incorrectly or as "Uncategorized"

**Solution:**
- Update keyword mapping in `transactionMerger.ts`:
  ```typescript
  const keywords: Record<string, string[]> = {
    'Food & Dining': ['restaurant', 'zomato', 'swiggy', ...],
    // Add your keywords here
  };
  ```

## Detailed Logging

The improved pipeline now logs:

```
📄 PDF uploaded
🔍 Extracting text from PDF...
✅ Raw text extracted: 15234 chars
🧹 Normalizing text...
✅ Text normalized: 14890 chars
✂️ Chunking text...
✅ Chunked into 8 chunks

🤖 Calling Gemini API for chunk 0...
📝 Chunk preview (first 200 chars): Date Narration Cheque No...
📤 LLM Response (first 300 chars): {"chunkId":"chunk_0_...
✅ Successfully parsed 12 transactions from chunk 0
   Sample transaction: 2025-08-01 - UPI/NEFT/Ram Card - ₹75.00

[Repeat for each chunk]

✅ LLM returned 95 transactions
🔀 Merging and categorizing transactions...
✅ Merged into final 87 transactions
✔️ Validating transactions...
✅ High confidence: 82, Low confidence: 5
💾 Saving to database...
✅ Saved 82 transactions to DB
🗑️ Temporary PDF deleted
⏱️ Total time taken: 18500ms
```

## Testing Checklist

- [ ] PDF is not password-protected
- [ ] PDF contains readable text (not just images)
- [ ] Environment variables are set correctly
- [ ] Backend server is running (`npm run dev`)
- [ ] User is authenticated (valid JWT token)
- [ ] Check console logs for detailed error messages
- [ ] Verify Gemini API quota hasn't been exceeded

## Quick Test

```bash
# Start server with verbose logging
npm run dev

# Upload PDF
curl -X POST http://localhost:5000/api/transactions/import-pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "pdf=@statement.pdf" \
  -v

# Check response and console logs
```

## If Still Not Working

1. **Save the console logs** - Copy all output
2. **Check the `preview` array** in the API response
3. **Verify the PDF format** - Try with a different bank statement
4. **Test with the test script:**
   ```bash
   npx ts-node src/scripts/testPdfPipeline.ts
   ```
