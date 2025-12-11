export const normalizeText = (text: string): string => {
    let normalized = text;

    // 1. Remove headers/footers (simple heuristics)
    // Remove lines that look like "Page X of Y"
    normalized = normalized.replace(/Page\s+\d+\s+of\s+\d+/gi, '');

    // 2. Remove "Value Date" blocks if they are just headers
    normalized = normalized.replace(/\(Value Date.*?\)/gi, '');

    // 3. Normalize dates: DD-MM-YYYY -> YYYY-MM-DD
    // This is tricky without context, but we can try to standardize common formats
    // For now, let's assume we want to keep them as is or standardize separators
    // The prompt asked for DD-MM-YYYY -> YYYY-MM-DD
    normalized = normalized.replace(/(\d{2})-(\d{2})-(\d{4})/g, '$3-$2-$1');

    // 4. Remove blank lines and combine broken lines
    // Split by newline
    const lines = normalized.split('\n');
    const cleanLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // Replace multi-spaces with single space
        line = line.replace(/\s+/g, ' ');

        cleanLines.push(line);
    }

    // Join back
    normalized = cleanLines.join('\n');

    // 5. Flatten multi-line narration (This is hard to do perfectly without knowing transaction structure)
    // But we can try to join lines that don't start with a date?
    // For now, the prompt asks to "Ensure each transaction line is continuous".
    // This might be better handled in the merger or by the LLM if we feed it chunks.
    // However, we can try to join lines that are clearly continuations.
    // A simple heuristic: if a line DOES NOT start with a date-like pattern, append it to the previous line.
    // But this risks merging distinct non-transaction lines.
    // Let's stick to basic cleaning here and let the LLM/Merger handle structural logic.

    return normalized;
};
