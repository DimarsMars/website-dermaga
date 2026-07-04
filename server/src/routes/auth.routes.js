const express = require('express');
const Joi = require('joi');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken, optionalAuth } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// ============================================================
// Joi Validation Schemas
// ============================================================

const PASSWORD_MIN = 8;

const passwordSchema = Joi.string()
  .min(PASSWORD_MIN)
  .messages({
    'string.min': `Password minimal ${PASSWORD_MIN} karakter`,
    'string.empty': 'Password wajib diisi',
    'any.required': 'Password wajib diisi',
  })
  .required();

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).alphanum().required().messages({
    'string.min': 'Username minimal 3 karakter',
    'string.max': 'Username maksimal 50 karakter',
    'string.alphanum': 'Username hanya boleh mengandung huruf dan angka',
    'string.empty': 'Username wajib diisi',
    'any.required': 'Username wajib diisi',
  }),
  password: passwordSchema,
  // Accept both camelCase (from RegisterPage client) and snake_case
  // (from MasterAgenPage admin form). At least one must be present.
  agencyName: Joi.string().min(2).max(100).allow('', null).optional().messages({
    'string.min': 'Nama perusahaan minimal 2 karakter',
    'string.max': 'Nama perusahaan maksimal 100 karakter',
  }),
  agency_name: Joi.string().min(2).max(100).allow('', null).optional().messages({
    'string.min': 'Nama perusahaan minimal 2 karakter',
    'string.max': 'Nama perusahaan maksimal 100 karakter',
  }),
  npwp: Joi.string().max(20).allow('', null).optional(),
  address: Joi.string().max(500).allow('', null).optional(),
  company_address: Joi.string().max(500).allow('', null).optional(),
  phone: Joi.string().max(20).allow('', null).optional(),
  phone_number: Joi.string().max(20).allow('', null).optional(),
  email: Joi.string().email().max(100).required().messages({
    'string.email': 'Format email tidak valid',
    'string.empty': 'Email wajib diisi',
    'any.required': 'Email wajib diisi',
  }),
  recaptchaToken: Joi.string().allow('', null).optional(),
}).or('agencyName', 'agency_name').messages({
  'object.missing': 'Nama perusahaan wajib diisi',
});

const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    'string.min': 'Username minimal 3 karakter',
    'string.max': 'Username maksimal 50 karakter',
    'string.empty': 'Username wajib diisi',
    'any.required': 'Username wajib diisi',
  }),
  password: Joi.string().min(1).required().messages({
    'string.empty': 'Password wajib diisi',
    'any.required': 'Password wajib diisi',
  }),
  recaptchaToken: Joi.string().allow('', null).optional(),
});

const resetPasswordRequestSchema = Joi.object({
  email: Joi.string().email().max(100).required().messages({
    'string.email': 'Format email tidak valid',
    'string.empty': 'Alamat email wajib diisi',
    'any.required': 'Alamat email wajib diisi',
  }),
});

const confirmResetPasswordSchema = Joi.object({
  token: Joi.string().min(8).max(64).required(),
  newPassword: passwordSchema,
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: passwordSchema,
});

const createOfficerSchema = Joi.object({
  employee_id: Joi.string().min(1).max(20).required().messages({
    'string.empty': 'Employee ID wajib diisi',
    'string.max': 'Employee ID maksimal 20 karakter',
    'any.required': 'Employee ID wajib diisi',
  }),
  username: Joi.string().min(3).max(50).alphanum().required().messages({
    'string.min': 'Username minimal 3 karakter',
    'string.max': 'Username maksimal 50 karakter',
    'string.alphanum': 'Username hanya boleh mengandung huruf dan angka',
    'string.empty': 'Username wajib diisi',
    'any.required': 'Username wajib diisi',
  }),
  password: passwordSchema,
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Nama minimal 2 karakter',
    'string.empty': 'Nama wajib diisi',
    'any.required': 'Nama wajib diisi',
  }),
  phone_number: Joi.string().max(20).allow('', null).optional(),
  email: Joi.string().email().max(100).required().messages({
    'string.email': 'Format email tidak valid',
    'string.empty': 'Email wajib diisi',
    'any.required': 'Email wajib diisi',
  }),
});

const createAdminSchema = Joi.object({
  employee_id: Joi.string().min(1).max(20).required().messages({
    'string.empty': 'Employee ID wajib diisi',
    'string.max': 'Employee ID maksimal 20 karakter',
    'any.required': 'Employee ID wajib diisi',
  }),
  username: Joi.string().min(3).max(50).alphanum().required().messages({
    'string.min': 'Username minimal 3 karakter',
    'string.max': 'Username maksimal 50 karakter',
    'string.alphanum': 'Username hanya boleh mengandung huruf dan angka',
    'string.empty': 'Username wajib diisi',
    'any.required': 'Username wajib diisi',
  }),
  password: passwordSchema,
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Nama minimal 2 karakter',
    'string.empty': 'Nama wajib diisi',
    'any.required': 'Nama wajib diisi',
  }),
  phone_number: Joi.string().max(20).allow('', null).optional(),
  email: Joi.string().email().max(100).required().messages({
    'string.email': 'Format email tidak valid',
    'string.empty': 'Email wajib diisi',
    'any.required': 'Email wajib diisi',
  }),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ============================================================
// Joi Validation Middleware
// ============================================================

/**
 * Creates a validation middleware for the given Joi schema.
 * Returns 422 VALIDATION_FIELDS on invalid input.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      // Gunakan pesan Joi pertama yang spesifik sebagai message utama,
      // agar frontend yang membaca error.message mendapat pesan yang jelas.
      const primaryMessage = details[0]?.message || 'Data yang dikirim tidak valid';
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_FIELDS',
          message: primaryMessage,
          details,
        },
      });
    }
    next();
  };
}

// ============================================================
// Routes
// ============================================================

/**
 * POST /api/auth/register
 * Agent (Agen_Kapal) registration - public endpoint.
 * Also used by authenticated admins (MasterAgenPage) to create an agent
 * account on behalf of a user. When an authenticated petugas/admin is the
 * caller, reCAPTCHA is skipped (they are already trusted).
 */
router.post('/register', optionalAuth, validate(registerSchema), authController.register);

/**
 * POST /api/auth/login
 * User login for all roles - public endpoint.
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * POST /api/auth/reset-password/confirm
 * Confirm password reset request - public endpoint.
 */
router.post('/reset-password/confirm', validate(confirmResetPasswordSchema), authController.confirmResetPassword);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token - public endpoint.
 */
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

/**
 * GET /api/auth/me
 * Get the full profile of the authenticated user.
 */
router.get('/me', authenticateToken, authController.getProfile);

/**
 * POST /api/auth/reset-password
 * Password reset request - public endpoint.
 */
router.post('/reset-password', validate(resetPasswordRequestSchema), authController.resetPassword);

/**
 * POST /api/auth/change-password
 * Change password for authenticated user.
 */
router.post('/change-password', authenticateToken, validate(changePasswordSchema), authController.changePassword);

/**
 * POST /api/auth/logout
 * Revoke the supplied refresh token (single-device logout).
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * POST /api/auth/create-officer
 * Admin creates a Petugas_Operasional account - Admin only.
 */
router.post('/create-officer',
  authenticateToken,
  authorize('admin'),
  validate(createOfficerSchema),
  authController.createOfficer
);

/**
 * POST /api/auth/create-admin
 * Admin creates another Admin account - Admin only.
 */
router.post('/create-admin',
  authenticateToken,
  authorize('admin'),
  validate(createAdminSchema),
  authController.createAdmin
);

module.exports = router;