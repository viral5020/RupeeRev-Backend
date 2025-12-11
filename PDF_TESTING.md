# PDF Import API Testing Guide

## Quick Test with cURL

### 1. Start the Backend Server
```bash
npm run dev
```

### 2. Upload a PDF
```bash
curl -X POST http://localhost:5000/api/transactions/import-pdf \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "pdf=@/path/to/your/bank-statement.pdf"
```

### 3. Expected Response
```json
{
  "success": true,
  "message": "PDF processed successfully",
  "data": {
    "totalTransactionsFound": 45,
    "highConfidenceCount": 42,
    "lowConfidenceCount": 3,
    "chunksParsed": 5,
    "timeTaken": 12500,
    "savedCount": 42,
    "preview": [...]
  }
}
```

## Test with Postman

1. **Method**: POST
2. **URL**: `http://localhost:5000/api/transactions/import-pdf`
3. **Headers**:
   - `Authorization: Bearer YOUR_JWT_TOKEN`
4. **Body** (form-data):
   - Key: `pdf`
   - Type: File
   - Value: Select your PDF file

## Test Script

Run the automated test:
```bash
# 1. Place a sample PDF in the backend folder as 'sample-statement.pdf'
# 2. Update the TEST_USER_ID in src/scripts/testPdfPipeline.ts
# 3. Run:
npx ts-node src/scripts/testPdfPipeline.ts
```

## Troubleshooting

### No transactions extracted
- Check console logs for LLM response
- Verify PDF is readable (not encrypted/password protected)
- Try a different bank statement format

### Low confidence scores
- Statement format may be unusual
- Adjust categorization keywords in `transactionMerger.ts`

### OCR fallback triggered
- PDF is image-based (scanned document)
- This is normal and expected for scanned statements

### API Key errors
- Verify `VITE_LLM_API_KEY` is set in `.env`
- Check Gemini API quota/limits
