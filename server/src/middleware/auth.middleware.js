const jwt = require('jsonwebtoken');

/**
 * JWT authentication middleware.
 * Extracts token from Authorization header (Bearer scheme),
 * verifies signature and expiry, attaches decoded user info to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_INVALID',
        message: 'Access token is required',
      },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_EXPIRED',
          message: 'Token has expired',
        },
      });
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_INVALID',
        message: 'Invalid token',
      },
    });
  }
}

module.exports = { authenticateToken };
