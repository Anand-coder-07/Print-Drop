const { queryGet } = require('../db');

/**
 * Generates a unique 4-digit code (1000–9999) that doesn't
 * collide with any currently active (pending) upload codes.
 */
function generateUniqueCode() {
  const maxAttempts = 100;

  for (let i = 0; i < maxAttempts; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const existing = queryGet(
      "SELECT id FROM uploads WHERE code = ? AND status = 'pending'",
      [code]
    );

    if (!existing) {
      return code;
    }
  }

  // Fallback: use a 5-digit code if 4-digit space is exhausted
  return String(Math.floor(10000 + Math.random() * 90000));
}

module.exports = { generateUniqueCode };
