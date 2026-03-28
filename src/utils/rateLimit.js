/**
 * Simple client-side rate limiter for public form submissions.
 * 
 * NOTE: This is NOT a substitute for server-side rate limiting.
 * It prevents casual double-submissions and basic abuse, but can be bypassed.
 * For robust protection, consider Firebase App Check or Cloud Functions.
 */

const _submissions = {};

/**
 * Check if a submission is allowed based on a cooldown period.
 * @param {string} key - Unique identifier for the action (e.g., 'editSuggestion', 'formulir_<pesertaId>')
 * @param {number} cooldownMs - Minimum time between submissions (default: 30 seconds)
 * @returns {boolean} true if submission is allowed, false if still in cooldown
 */
export function canSubmit(key, cooldownMs = 30000) {
    const now = Date.now();
    const last = _submissions[key];
    if (last && now - last < cooldownMs) {
        return false;
    }
    _submissions[key] = now;
    return true;
}

/**
 * Get remaining cooldown time in seconds.
 * @param {string} key - The submission key
 * @param {number} cooldownMs - The cooldown period
 * @returns {number} Remaining seconds, or 0 if no cooldown active
 */
export function getCooldownRemaining(key, cooldownMs = 30000) {
    const last = _submissions[key];
    if (!last) return 0;
    const remaining = cooldownMs - (Date.now() - last);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Reset a specific rate limit key (e.g., after page navigation).
 * @param {string} key - The submission key to reset
 */
export function resetRateLimit(key) {
    delete _submissions[key];
}
