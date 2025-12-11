# PDF Extraction Pipeline - Quick Reference

## 📍 API Endpoint
```
POST /api/transactions/import-pdf
```

**Headers**: `Authorization: Bearer <token>`  
**Body**: `multipart/form-data` with `pdf` field

## ⚙️ Environment Variables
```bash
VITE_LLM_API_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
VITE_LLM_API_KEY=yourkey
VITE_LLM_MODEL=gemini-1.5-flash
```

## 🔄 Pipeline Flow
1. **PDF Upload** → Extract text (pdf-parse)
2. **Quality Check** → OCR fallback if needed (Tesseract)
3. **Normalize** → Clean text, fix dates
4. **Chunk** → Split into 2000-char chunks (200 overlap)
5. **LLM Extract** → Gemini extracts transactions
6. **Merge** → Deduplicate & categorize
7. **Validate** → Check data quality
8. **Save** → Store high-confidence transactions
9. **Cleanup** → Delete temporary PDF

## 📊 Response Format
```json
{
  "totalTransactionsFound": 45,
  "highConfidenceCount": 42,
  "lowConfidenceCount": 3,
  "chunksParsed": 5,
  "timeTaken": 12500,
  "savedCount": 42,
  "preview": [...]
}
```

## 🎯 Key Features
✅ Automatic OCR fallback  
✅ LLM-powered extraction  
✅ Smart deduplication  
✅ Keyword-based categorization  
✅ Confidence scoring  
✅ Auto-cleanup  
✅ Comprehensive logging  

## 📝 Files Created
- `services/pdfTextExtractor.ts`
- `services/ocrExtractor.ts`
- `services/textNormalizer.ts`
- `services/chunker.ts`
- `services/llmTransactionExtractor.ts`
- `services/transactionMerger.ts`
- `services/validator.ts`
- `services/pdfImportService.ts`
- `scripts/testPdfPipeline.ts`

## 🧪 Testing
See [PDF_TESTING.md](file:///c:/Users/admin/Desktop/money%20manager/backend/PDF_TESTING.md)
