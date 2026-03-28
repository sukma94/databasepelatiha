/**
 * Levenshtein Distance: measures the number of single-character edits
 * (insertions, deletions, substitutions) required to change one word into another.
 */
export function levenshtein(a, b) {
    const an = a.length;
    const bn = b.length;
    const matrix = [];

    for (let i = 0; i <= an; i++) matrix[i] = [i];
    for (let j = 0; j <= bn; j++) matrix[0][j] = j;

    for (let i = 1; i <= an; i++) {
        for (let j = 1; j <= bn; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,       // deletion
                matrix[i][j - 1] + 1,       // insertion
                matrix[i - 1][j - 1] + cost  // substitution
            );
        }
    }
    return matrix[an][bn];
}

/**
 * Calculate similarity ratio between two strings (0 to 1).
 * 1 = exact match, 0 = completely different.
 */
export function similarity(a, b) {
    if (!a || !b) return 0;
    const la = a.toLowerCase().trim();
    const lb = b.toLowerCase().trim();
    if (la === lb) return 1;
    const maxLen = Math.max(la.length, lb.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(la, lb) / maxLen;
}

/**
 * Find groups of similar names from a list of peserta.
 * @param {Array} pesertaList - Array of peserta objects with at least { id, nama }
 * @param {number} threshold - Similarity threshold (0-1), default 0.8 (80%)
 * @returns {Array} Array of groups, each group is an array of peserta with similar names
 */
export function findSimilarNames(pesertaList, threshold = 0.8) {
    const groups = [];
    const visited = new Set();

    for (let i = 0; i < pesertaList.length; i++) {
        if (visited.has(pesertaList[i].id)) continue;
        const group = [pesertaList[i]];

        for (let j = i + 1; j < pesertaList.length; j++) {
            if (visited.has(pesertaList[j].id)) continue;
            // Skip if different training level — same person in different levels is allowed
            if (pesertaList[i].level !== pesertaList[j].level) continue;

            const nameSim = similarity(pesertaList[i].nama, pesertaList[j].nama);

            // Exact WA match (cleaning non-digits first)
            const wa1 = String(pesertaList[i].wa || '').replace(/\D/g, '');
            const wa2 = String(pesertaList[j].wa || '').replace(/\D/g, '');
            const waMatch = wa1 && wa2 && wa1 === wa2;

            if (nameSim >= threshold || waMatch) {
                group.push(pesertaList[j]);
                visited.add(pesertaList[j].id);
            }
        }

        if (group.length > 1) {
            visited.add(pesertaList[i].id);
            groups.push(group);
        }
    }
    return groups;
}
