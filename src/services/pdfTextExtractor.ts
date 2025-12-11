import * as pdfParse from 'pdf-parse';
import { extractTextWithOCR } from './ocrExtractor';

export const extractTextFromPDF = async (buffer: Buffer): Promise<string> => {
    try {
        const data = await (pdfParse as any).default(buffer);
        let text = data.text;

        // Check for poor extraction quality
        // 1. Too short
        // 2. Too many non-printable/weird characters (heuristic)
        const isLowQuality = text.length < 500 || (text.match(/[\uFFFD\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g) || []).length > text.length * 0.1;

        if (isLowQuality) {
            console.log('Direct PDF extraction yielded low quality text. Triggering OCR fallback...');
            text = await extractTextWithOCR(buffer);
        } else {
            console.log(`Direct PDF extraction successful. Extracted ${text.length} characters.`);
        }

        return text;
    } catch (error) {
        console.error('Error during direct PDF extraction:', error);
        console.log('Triggering OCR fallback due to error...');
        return await extractTextWithOCR(buffer);
    }
};
