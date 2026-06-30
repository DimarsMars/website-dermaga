const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const RefreshTokenModel = require('../models/refreshToken.model');

/**
 * Service for issuing, verifying, rotating, and revoking refresh tokens.
 *
 * Lifecycle:
 *   issue()      — on login: generate JWT refresh token, persist its SHA-256 hash
 *   rotate()    — on refresh endpoint: verify old token, revoke it, issue new pair
 *   revoke()    — on logout: revoke the supplied token
 *   revokeAll() — on change-password: revoke every active token for that user
 *
 * The refresh token returned to the client is a JWT signed with
 * JWT_REFRESH_SECRET. The DATABASE NEVER STORES the raw token — only its
 * SHA-256 hash. A stolen database cannot be replayed; a stolen raw token
 * can be revoked without waiting for expiry.
 */
const RefreshTokenService = {
  /**
   * Hash a raw refresh token using SHA-256. Returns hex digest.
   * @param {string} token
   * @returns {string}
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  /**
   * Compute the refresh token expiry as a Date (default 7 days).
   * @returns {Date}
   */
  computeExpiry() {
    const ttlMs = parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || '7d');
    return new Date(Date.now() + ttlMs);
  },

  /**
   * Issue a new refresh token for a user and persist its hash.
   *
   * @param {{ id: number, username: string, role: string, userType: string }} payload
   * @returns {Promise<string>} The raw refresh token JWT (to send to client)
   */
  async issue(payload) {
    const token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    await RefreshTokenModel.create({
      user_id: payload.id,
      user_type: payload.userType,
      token_hash: this.hashToken(token),
      expires_at: this.computeExpiry(),
    });

    return token;
  },

  /**
   * Verify a refresh token and rotate it: revoke the old token, issue a new one.
   *
   * @param {string} rawToken - The refresh token JWT received from the client
   * @returns {Promise<{ payload: object, newAccessToken: string, newRefreshToken: string }>}
   * @throws {Error} if token is invalid, expired, revoked, or not found in DB
   */
  async rotate(rawToken) {
    if (!rawToken) {
      throw new TokenError('Refresh token required', 'AUTH_INVALID');
    }

    // 1. Verify JWT signature/expiry
    let decoded;
    try {
      decoded = jwt.verify(rawToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new TokenError('Refresh token expired or invalid', 'AUTH_EXPIRED');
    }

    // 2. Verify the token is still tracked & not revoked in DB
    const stored = await RefreshTokenModel.findActiveByHash(this.hashToken(rawToken));
    if (!stored) {
      // Token signature valid but not found in DB → may have been revoked
      // (logout, change-password, or rotation already consumed it). Reject.
      throw new TokenError('Refresh token has been revoked', 'AUTH_EXPIRED');
    }

    // 3. Revoke the old token (rotation: one-time-use refresh tokens)
    await RefreshTokenModel.revokeById(stored.id);

    // 4. Rebuild payload (don't trust arbitrary claims — keep only what we control)
    const payload = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      userType: decoded.userType,
    };

    // 5. Issue a new access token + new refresh token (and persist its hash)
    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '2h',
    });
    const newRefreshToken = await this.issue(payload);

    return { payload, newAccessToken, newRefreshToken };
  },

  /**
   * Revoke a single refresh token (logout of this device).
   * @param {string} rawToken
   * @returns {Promise<boolean>} True if a token was actually revoked
   */
  async revoke(rawToken) {
    if (!rawToken) return false;
    const hash = this.hashToken(rawToken);
    const stored = await RefreshTokenModel.findActiveByHash(hash);
    if (!stored) return false;
    await RefreshTokenModel.revokeById(stored.id);
    return true;
  },

  /**
   * Revoke all active refresh tokens for a user (change-password / logout-all).
   * @param {number} userId
   * @param {string} userType - 'agen' | 'petugas' | 'admin'
   * @returns {Promise<number>} Number of tokens revoked
   */
  async revokeAllForUser(userId, userType) {
    return RefreshTokenModel.revokeAllForUser(userId, userType);
  },
};

/**
 * Custom Error subclass carrying an error code for the auth controller to
 * translate to a clean 401 response without leaking internal details.
 */
class TokenError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * Parse a simple duration string like '7d', '15m', '2h', '60s' into ms.
 * Used to mirror JWT_REFRESH_EXPIRES_IN into the DB expires_at column.
 */
function parseDuration(str) {
  const m = String(str).trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const num = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return num * multipliers[unit];
}

module.exports = RefreshTokenService;