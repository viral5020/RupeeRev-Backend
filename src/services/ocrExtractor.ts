import * as Tesseract from 'tesseract.js';

export const extractTextWithOCR = async (buffer: Buffer): Promise<string> => {
    try {
        console.log('Starting OCR extraction...');
        // Tesseract.recognize can take a buffer directly
        const result = await Tesseract.recognize(
            buffer,
            'eng',
            {
                logger: m => console.log(`OCR Progress: ${m.status} (${(m.progress * 100).toFixed(0)}%)`)
            }
        );

        const text = result.data.text;
        console.log(`OCR extraction complete. Extracted ${text.length} characters.`);
        return text;
    } catch (error) {
        console.error('OCR extraction failed:', error);
        throw new Error('Failed to extract text from PDF using OCR.');
    }
};
