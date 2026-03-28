/**
 * Formats a string based on the chosen global format.
 * @param {string} text - The input string to format.
 * @param {string} format - One of 'upper', 'capitalize', 'sentence', or 'none'.
 * @returns {string} - The formatted string.
 */
export function formatString(text, format) {
    if (!text || !format || format === 'none') return text;

    const str = String(text);
    const words = str.split(' ');

    const formattedWords = words.map((word, index) => {
        // Heuristic: words with dots (M.Pd., S.Pd. dr. etc) are titles/abbreviations
        // We skip formatting for these titles to preserve their specific casing
        const isTitle = word.includes('.');

        if (isTitle) return word;

        switch (format) {
            case 'upper':
                return word.toUpperCase();
            case 'capitalize':
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            case 'sentence':
                // In sentence case, only capitalize the very first word of the string
                if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                return word.toLowerCase();
            default:
                return word;
        }
    });

    return formattedWords.join(' ');
}

/**
 * Formats a phone number for a WhatsApp link (ensure 62 prefix)
 * @param {string} wa - The input phone number.
 * @returns {string} - The formatted phone numbers only.
 */
export function formatWhatsApp(wa) {
    if (!wa) return '';
    let cleaned = wa.replace(/\D/g, ''); // Remove non-digits
    if (cleaned.startsWith('0')) {
        return '62' + cleaned.slice(1);
    }
    if (cleaned.startsWith('8')) {
        return '62' + cleaned;
    }
    return cleaned;
}
