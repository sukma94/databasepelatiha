/**
 * Input validation & sanitization utilities for public-facing forms.
 * Prevents XSS, enforces size limits, and validates common field formats.
 */

/**
 * Strip HTML tags and trim string to max length.
 */
export function sanitizeString(str, maxLength = 200) {
    if (typeof str !== 'string') return str; // preserve non-string values (null, numbers, etc.)
    return str
        .trim()
        .slice(0, maxLength)
        .replace(/<[^>]*>/g, ''); // Strip HTML tags
}

/**
 * Validate Indonesian WhatsApp number format.
 * Accepts: 08xxx, 628xxx, +628xxx
 */
export function validateWhatsApp(wa) {
    if (!wa || typeof wa !== 'string') return false;
    const cleaned = wa.replace(/[\s\-\+]/g, '');
    return /^(08|628|08)[0-9]{8,14}$/.test(cleaned);
}

/**
 * Validate a person's name (2-100 chars, no HTML).
 */
export function validateName(name) {
    const cleaned = sanitizeString(name, 100);
    return cleaned.length >= 2 && cleaned.length <= 100;
}

/**
 * Sanitize an entire form data object.
 * Trims all string fields and strips HTML tags.
 * @param {Object} data - Raw form data
 * @param {Object} fieldLimits - Optional map of field name → max char length
 * @returns {Object} Sanitized data
 */
export function sanitizeFormData(data, fieldLimits = {}) {
    if (!data || typeof data !== 'object') return {};
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            const maxLen = fieldLimits[key] || 500;
            result[key] = sanitizeString(value, maxLen);
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Validate that required fields are present and non-empty.
 * @param {Object} data - Form data
 * @param {string[]} requiredFields - Array of required field names
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateRequired(data, requiredFields) {
    const missing = [];
    for (const field of requiredFields) {
        const val = data[field];
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
            missing.push(field);
        }
    }
    return { valid: missing.length === 0, missing };
}
