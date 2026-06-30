const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

/**
 * POST /api/auth/register
 * Agent (Agen_Kapal) registration - public endpoint.
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/login
 * User login for all roles - public endpoint.
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/reset-password/confirm
 * Confirm password reset request - public endpoint.
 */
router.post('/reset-password/confirm', authController.confirmResetPassword);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token - public endpoint.
 */
router.post('/refresh', authController.refreshToken);

/**
 * GET /api/auth/me
 * Get the full profile of the authenticated user.
 */
router.get('/me', authenticateToken, authController.getProfile);

/**
 * POST /api/auth/reset-password
 * Password reset request - public endpoint.
 */
router.post('/reset-password', authController.resetPassword);

/**
 * POST /api/auth/change-password
 * Change password for authenticated user.
 */
router.post('/change-password', authenticateToken, authController.changePassword);

/**
 * POST /api/auth/create-officer
 * Admin creates a Petugas_Operasional account - Admin only.
 */
router.post('/create-officer', authenticateToken, authorize('admin'), authController.createOfficer);

/**
 * POST /api/auth/create-admin
 * Admin creates another Admin account - Admin only.
 */
router.post('/create-admin', authenticateToken, authorize('admin'), authController.createAdmin);

module.exports = router;
