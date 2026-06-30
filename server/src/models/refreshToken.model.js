const pool = require('../config/db');

/**
 * RefreshToken model storing SHA-256 hashes of refresh tokens.
 *
 * Raw refresh tokens are NEVER persisted — only their SHA-256 hash is
 * stored, so a database leak cannot be replayed to mint new access tokens.
 * The token hash is computed by RefreshTokenService using crypto.createHash.
 */
const RefreshTokenModel = {
  /**
   * Persist a new refresh token hash.
   * @param {{ user_id: number, user_type: string, token_hash: string, expires_at: Date }} data
   * @returns {Promise<object>} The created row
   */
  async create({ user_id, user_type, token_hash, expires_at }) {
    const result = await pool.query(
      `INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, user_type, issued_at, expires_at, revoked_at`,
      [user_id, user_type, token_hash, expires_at]
    );
    return result.rows[0];
  },

  /**
   * Find an active (non-revoked) token by its hash.
   * @param {string} token_hash - SHA-256 hex digest of the refresh token
   * @returns {Promise<object|null>} Row or null if not found / revoked / expired
   */
  async findActiveByHash(token_hash) {
    const result = await pool.query(
      `SELECT id, user_id, user_type, issued_at, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [token_hash]
    );
    return result.rows[0] || null;
  },

  /**
   * Mark a single token as revoked.
   * @param {number} id - Token row id
   * @returns {Promise<object|null>} Updated row or null
   */
  async revokeById(id) {
    const result = await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Revoke all active tokens for a user (e.g. on change password / logout-all).
   * @param {number} user_id
   * @param {string} user_type
   * @returns {Promise<number>} Number of tokens revoked
   */
  async revokeAllForUser(user_id, user_type) {
    const result = await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND user_type = $2 AND revoked_at IS NULL`,
      [user_id, user_type]
    );
    return result.rowCount;
  },

  /**
   * Delete expired-and-revoked rows older than the given cutoff.
   * Used by periodic pruning jobs (best practice to avoid table bloat).
   * @param {Date} [cutoff] - Defaults to NOW()
   * @returns {Promise<number>} Number of rows deleted
   */
  async pruneExpiredAndRevoked(cutoff = new Date()) {
    const result = await pool.query(
      `DELETE FROM refresh_tokens
       WHERE expires_at < $1 OR revoked_at IS NOT NULL`,
      [cutoff]
    );
    return result.rowCount;
  },
};

module.exports = RefreshTokenModel;