import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
import { createCanvas } from "canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.js";
// NOTE: This code is designed for a Node.js environment where these dependencies (pdf-parse, Tesseract, canvas, pdfjs-dist)
// are installed and available. It will not run directly in a standard browser/client-side environment.

// 1. FIX: Define the missing type interface for a self-contained file.
export interface PDFExtractionResult {
    rawText: string;
    method: "ocr" | "pdf-parse";
    pageCount: number;
}

/**
 * TRUE GPay Detector
 * Checks for GPay/UPI keywords in the text extracted by pdf-parse.
 */
const isGPayPDF = async (pdfBuffer: Buffer): Promise<boolean> => {
    try {
        const data = await pdfParse(pdfBuffer);
        const text = data.text.toLowerCase();
        return (
            text.includes("google pay") ||
            text.includes("gpay") ||
            text.includes("upi transaction") ||
            text.includes("upi id") ||
            text.includes("upi")
        );
    } catch (e) {
        console.error("Error during initial PDF parse check:", e);
        return false;
    }
};

/**
 * MAIN FUNCTION
 * Determines the best extraction method (OCR or pdf-parse) based on content.
 */
export const extractTextFromGPayPDF = async (
    pdfBuffer: Buffer
): Promise<PDFExtractionResult> => {
    console.log("📄 Starting PDF processing...");

    if (await isGPayPDF(pdfBuffer)) {
        console.log("💳 Detected GPay PDF → Using OCR ONLY");
        const ocrRes = await extractWithOCRParallel(pdfBuffer);
        return {
            rawText: ocrRes.text,
            method: "ocr",
            pageCount: ocrRes.pageCount,
        };
    }

    console.log("🏦 Detected Bank Statement → Using pdf-parse ONLY");
    const data = await pdfParse(pdfBuffer);
    return {
        rawText: data.text,
        method: "pdf-parse",
        pageCount: data.numpages,
    };
};

/**
 * Optimized OCR: process pages in parallel
 */
const extractWithOCRParallel = async (
    pdfBuffer: Buffer
): Promise<{ text: string; pageCount: number }> => {
    console.log("🔍 Starting parallel OCR pipeline…");

    const loadingTask = getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    console.log(`📄 PDF has ${pageCount} pages`);

    // Map each page to a promise for OCR
    const ocrPromises = Array.from({ length: pageCount }, (_, index) => (async () => {
        const pageNum = index + 1;
        console.log(`➡️ Page ${pageNum}/${pageCount}: rendering image...`);

        const page = await pdf.getPage(pageNum);
        // Using a scale of 2 for better OCR results
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D; // Type assertion needed for pdfjs

        // Render PDF page to canvas
        await page.render({ canvasContext: context, viewport }).promise;

        const imgBuffer = canvas.toBuffer("image/png");

        // 2. FIX: Use createWorker to properly set parameters
        const worker = await Tesseract.createWorker("eng", Tesseract.OEM.DEFAULT, {
            logger: (m) => {
                if (m.status === "recognizing text") {
                    console.log(`Page ${pageNum} OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        });

        const { data } = await worker.recognize(imgBuffer);
        await worker.terminate();

        const cleanedText = data.text
            .replace(/\r/g, "\n")
            .replace(/\n{2,}/g, "\n")
            .trim();

        return { pageNum, text: cleanedText };
    })());

    // Run all OCR tasks in parallel
    const ocrResults = await Promise.all(ocrPromises);

    // Sort pages in order just in case
    ocrResults.sort((a, b) => a.pageNum - b.pageNum);

    const fullText = ocrResults.map(r => r.text).join("\n");

    return { text: fullText, pageCount };
};