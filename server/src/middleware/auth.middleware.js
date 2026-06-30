const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * JWT authentication middleware.
 * - Verifies signature and expiry of the access token.
 * - Verifies the token_version in the JWT still matches the user's current
 *   token_version in the database. Mismatch (e.g. after a password change)
 *   invalidates the access token immediately, even before its natural expiry.
 *
 * On success, attaches decoded user info to req.user.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID', message: 'Access token is required' },
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_EXPIRED', message: 'Token has expired' },
      });
    }
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID', message: 'Invalid token' },
    });
  }

  // Verify token_version against the database (instant invalidation after
  // password change). Falls back gracefully if the column is absent on
  // legacy databases (treated as version 0).
  try {
    const currentVersion = await getCurrentTokenVersion(decoded.id, decoded.userType);
    if (currentVersion !== null && currentVersion !== decoded.tokenVersion) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_EXPIRED', message: 'Session has been invalidated, please log in again' },
      });
    }
  } catch (err) {
    // Don't block auth on transient DB errors — fail-open is reasonable here
    // because the access token is short-lived and refresh flow still checks
    // the hashed refresh token against the DB. Log for visibility.
    console.error('auth.middleware: token_version check failed:', err.message);
  }

  req.user = decoded;
  next();
}

/**
 * Fetch the current token_version for a user.
 * Returns null when the user is not found (caller treats as no-op).
 */
async function getCurrentTokenVersion(id, userType) {
  let result;
  if (userType === 'agen') {
    result = await pool.query(
      'SELECT token_version FROM master_agen WHERE id_agen = $1',
      [id]
    );
  } else {
    result = await pool.query(
      'SELECT token_version FROM master_petugas WHERE id_petugas = $1',
      [id]
    );
  }
  if (!result.rows.length) return null;
  return Number(result.rows[0].token_version);
}

/**
 * Optional authentication middleware — same as authenticateToken but never
 * returns 401. If a valid token is present, attaches the decoded user to
 * req.user so downstream handlers can use it; otherwise next() is called
 * anyway. Used by endpoints that serve BOTH public requests and authenticated
 * admin requests (e.g. POST /api/auth/register, where an admin creating an
 * agent account on behalf of someone else should skip reCAPTCHA).
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentVersion = await getCurrentTokenVersion(decoded.id, decoded.userType);
    if (currentVersion !== null && currentVersion !== decoded.tokenVersion) {
      // Token invalidated (e.g. post password change) — treat as anonymous.
      return next();
    }
    req.user = decoded;
  } catch {
    // Invalid/expired token on optional route → proceed anonymously.
  }
  return next();
}

module.exports = { authenticateToken, optionalAuth };