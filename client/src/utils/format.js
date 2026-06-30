// Display helpers for activity log text.

/**
 * Clean up activity log messages for display.
 * Converts technical-looking references like "(ID: 10)" or "id_booking: 10"
 * into a friendlier booking reference like "#10", without touching the raw data
 * (the raw `keterangan` is still used for filtering logs by booking).
 *
 * @param {string} text - The raw activity log description.
 * @returns {string} The cleaned-up message for display.
 */
export function formatLogMessage(text) {
  if (!text) return text;
  return text
    .replace(/\(\s*ID:\s*(\d+)\s*\)/gi, '#$1')
    .replace(/\bid_booking:\s*(\d+)/gi, '#$1');
}

/**
 * Format a numeric value for display, stripping trailing zeros.
 * Examples: "80.00" -> "80", "3000.00" -> "3000", "80.50" -> "80.5".
 *
 * @param {number|string|null|undefined} value - The raw numeric value.
 * @returns {string} The cleaned-up number, or '' for empty/invalid input.
 */
export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return String(num);
}
