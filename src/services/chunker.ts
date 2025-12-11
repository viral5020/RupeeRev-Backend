export interface TextChunk {
    chunkId: string;
    pageIndex: number; // We might not have page index if we just have raw text, but let's try to support it if possible.
    chunkIndex: number;
    text: string;
}

export const chunkText = (text: string, chunkSize: number = 2000, overlap: number = 200): TextChunk[] => {
    const chunks: TextChunk[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
        let endIndex = startIndex + chunkSize;

        // Ensure we don't cut words in half if possible (simple heuristic: look for space)
        if (endIndex < text.length) {
            const lastSpace = text.lastIndexOf(' ', endIndex);
            if (lastSpace > startIndex + chunkSize * 0.8) { // Only backtrack if it's not too far
                endIndex = lastSpace;
            }
        }

        const chunkText = text.slice(startIndex, endIndex);

        chunks.push({
            chunkId: `chunk_${chunkIndex}_${Date.now()}`,
            pageIndex: 0, // We are processing the whole text as one block for now as pdf-parse returns one string
            chunkIndex: chunkIndex,
            text: chunkText
        });

        startIndex = endIndex - overlap;
        chunkIndex++;

        // Avoid infinite loop if overlap >= chunkSize (shouldn't happen with default values)
        if (startIndex >= endIndex) {
            startIndex = endIndex;
        }
    }

    return chunks;
};
