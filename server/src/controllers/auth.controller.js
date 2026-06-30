const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const RefreshTokenService = require('../services/refreshToken.service');

const SALT_ROUNDS = 12;

/**
 * PostgreSQL unique-violation error code (23505). Used by unique email checks.
 */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * If the given error is a PostgreSQL unique violation on the email column,
 * return true. Used to translate DB errors into 409 responses.
 */
function isDuplicateEmailError(err) {
  return err && err.code === PG_UNIQUE_VIOLATION &&
    typeof err.constraint === 'string' && err.constraint.includes('email');
}

/**
 * Generate access token (short-lived) only. Refresh tokens are issued
 * through RefreshTokenService which also persists their hash server-side
 * for rotation / revocation.
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Verify Google reCAPTCHA token server-side.
 *
 * Returns an object { valid, error } so callers can distinguish between
 * "skipped in development" and "verification failed".
 */
async function verifyRecaptcha(token) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    if (isProduction) {
      return { valid: false, error: 'reCAPTCHA secret key not configured on server' };
    }
    // Skip verification in development when secret key is not configured
    return { valid: true };
  }

  if (!token) {
    return { valid: false, error: 'reCAPTCHA token is required' };
  }

  try {
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(token)}`,
      }
    );
    const data = await response.json();
    return { valid: data.success === true };
  } catch (err) {
    console.error('reCAPTCHA verification error:', err.message);
    return { valid: false, error: 'reCAPTCHA verification failed' };
  }
}

/**
 * POST /api/auth/register
 * Agent (Agen_Kapal) registration.
 */
async function register(req, res) {
  try {
    // Accept both camelCase (client) and snake_case (legacy/test) field names
    const body = req.body || {};
    const username = body.username;
    const password = body.password;
    const agency_name = body.agencyName ?? body.agency_name;
    const npwp = body.npwp;
    const company_address = body.address ?? body.company_address;
    const phone_number = body.phone ?? body.phone_number;
    const email = body.email;
    const recaptchaToken = body.recaptchaToken;

    // Verify reCAPTCHA (mandatory in production for public self-registration).
    // Authenticated admins/petugas creating an agent account (via
    // MasterAgenPage) are already trusted — skip captcha for them so the
    // admin form doesn't need to embed a reCAPTCHA widget.
    const isTrustedCaller = req.user && (req.user.role === 'admin' || req.user.role === 'petugas');
    if (!isTrustedCaller) {
      if (isProduction && !recaptchaToken) {
        return res.status(400).json({
          success: false,
          error: { code: 'RECAPTCHA_REQUIRED', message: 'reCAPTCHA token is required' },
        });
      }
      const captchaResult = await verifyRecaptcha(recaptchaToken);
      if (!captchaResult.valid) {
        return res.status(400).json({
          success: false,
          error: { code: 'RECAPTCHA_FAILED', message: captchaResult.error || 'reCAPTCHA verification failed' },
        });
      }
    }

    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT id_agen FROM master_agen WHERE username = $1',
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Username already exists' },
      });
    }

    // Check if email already exists
    const existingEmail = await pool.query(
      'SELECT id_agen FROM master_agen WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Email already registered' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new agent
    let result;
    try {
      result = await pool.query(
        `INSERT INTO master_agen (username, password, agency_name, npwp, company_address, phone_number, email)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id_agen, username, agency_name, email, created_at`,
        [username, hashedPassword, agency_name, npwp || null, company_address || null, phone_number || null, email || null]
      );
    } catch (insertErr) {
      if (isDuplicateEmailError(insertErr)) {
        return res.status(409).json({
          success: false,
          error: { code: 'VALIDATION_FIELDS', message: 'Email already registered' },
        });
      }
      throw insertErr;
    }

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    });
  }
}

/**
 * POST /api/auth/login
 * User login for all roles (agen, petugas, admin).
 * Uses generic error messages that don't reveal which credential field is incorrect.
 */
async function login(req, res) {
  try {
    const { username, password, recaptchaToken } = req.body;

    // Verify reCAPTCHA (mandatory in production)
    if (isProduction && !recaptchaToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'RECAPTCHA_REQUIRED', message: 'reCAPTCHA token is required' },
      });
    }
    const captchaResult = await verifyRecaptcha(recaptchaToken);
    if (!captchaResult.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'RECAPTCHA_FAILED', message: captchaResult.error || 'reCAPTCHA verification failed' },
      });
    }

    // Try to find user in master_agen first
    let user = null;
    let userType = null;
    let role = null;
    let userId = null;

    const agenResult = await pool.query(
      'SELECT id_agen, username, password, token_version FROM master_agen WHERE username = $1',
      [username]
    );

    if (agenResult.rows.length > 0) {
      user = agenResult.rows[0];
      userType = 'agen';
      role = 'agen';
      userId = user.id_agen;
    } else {
      // Try master_petugas
      const petugasResult = await pool.query(
        'SELECT id_petugas, username, password, user_role, token_version FROM master_petugas WHERE username = $1',
        [username]
      );

      if (petugasResult.rows.length > 0) {
        user = petugasResult.rows[0];
        userType = 'petugas';
        role = user.user_role; // 'petugas' or 'admin'
        userId = user.id_petugas;
      }
    }

    // Generic error: don't reveal which field is wrong
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Invalid credentials' },
      });
    }

    // Compare password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Invalid credentials' },
      });
    }

    // Generate JWT tokens — include token_version so the auth middleware can
    // reject access tokens issued before a password change.
    const tokenPayload = {
      id: userId,
      username: user.username,
      role,
      userType,
      tokenVersion: user.token_version || 0,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = await RefreshTokenService.issue(tokenPayload);

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: userId,
          username: user.username,
          role,
          userType,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    });
  }
}

/**
 * POST /api/auth/reset-password
 * Password reset request. Sends reset link to registered email.
 */
const crypto = require('crypto');
const transporter = require('../config/email');

async function resetPassword(req, res) {
  try {
    const { email } = req.body;
    let targetTable = null;

    // Check if email belongs to master_agen
    const agenCheck = await pool.query(
      'SELECT id_agen FROM master_agen WHERE email = $1',
      [email]
    );

    if (agenCheck.rows.length > 0) {
      targetTable = 'master_agen';
    } else {
      // If not found in master_agen, check master_petugas
      const petugasCheck = await pool.query(
        'SELECT id_petugas FROM master_petugas WHERE email = $1',
        [email]
      );
      if (petugasCheck.rows.length > 0) {
        targetTable = 'master_petugas';
      }
    }

    // If user found in either table, generate token and send email
    if (targetTable) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

      await pool.query(
        `UPDATE ${targetTable} SET reset_token = $1, reset_token_expires = $2 WHERE email = $3`,
        [token, expires, email]
      );

      const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;

      await transporter.sendMail({
        from: `"Pra-Booking Dermaga" <${process.env.EMAIL_USER}>`, // Menampilkan nama pengirim yang resmi
        to: email,
        subject: '🔒 Tautan Pemulihan Kata Sandi Anda',
        html: `
          <div style="background-color: #f4f6f9; padding: 30px 15px; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #333333; line-height: 1.6;">
            <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border-top: 5px solid #1e3a5f;">
              
              <!-- Header / Banner -->
              <div style="background-color: #1e3a5f; padding: 30px 20px; text-align: center;">
                <!-- MENGGANTI EMOJI DENGAN LOGO RESMI (Lebar disesuaikan agar proporsional di email) -->
                <img 
                  src="cid:logo-dermaga-biru"
                  alt="Smart Berth Logo" 
                  width="220" 
                  style="display: block; margin: 0 auto 15px auto; border: 0; max-width: 100%; height: auto;" 
                />
                <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                  Pra-Booking Dermaga
                </h1>
                <p style="color: #cbd5e1; margin: 5px 0 0 0; font-size: 13px;">Pelabuhan Benoa, Denpasar</p>
              </div>

              <!-- Isi Email Body -->
              <div style="padding: 30px 25px;">
                <p style="margin-top: 0; font-size: 15px; font-weight: 600; color: #1e3a5f;">Halo Pengguna Sistem,</p>
                <p style="font-size: 14px; color: #4b5563;">
                  Kami menerima permintaan untuk melakukan atur ulang (*reset*) kata sandi akun Anda. Jangan khawatir, akun Anda tetap aman. Silakan klik tombol di bawah ini untuk membuat kata sandi baru Anda:
                </p>
                
                <!-- Tombol CTA (Call to Action) -->
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" target="_blank" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 14px; font-weight: 600; border-radius: 8px; display: inline-block; box-shadow: 0 2px 5px rgba(22, 163, 74, 0.3);">
                    Atur Ulang Kata Sandi
                  </a>
                </div>

                <!-- Informasi Batas Waktu -->
                <div style="background-color: #f9fafb; border-left: 4px solid #eab308; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
                  <p style="margin: 0; font-size: 12.5px; color: #71717a;">
                    <strong>Penting:</strong> Tautan ini hanya berlaku selama <strong>1 jam</strong> sejak email ini dikirimkan demi menjaga keamanan akses data dermaga Anda.
                  </p>
                </div>

                <!-- Tautan Cadangan jika tombol bermasalah -->
                <p style="font-size: 12px; color: #9ca3af; margin-bottom: 5px;">
                  Jika tombol di atas tidak berfungsi, Anda juga dapat menyalin dan menempelkan tautan berikut ke browser Anda:
                </p>
                <p style="font-size: 12px; margin: 0; word-break: break-all;">
                  <a href="${resetLink}" target="_blank" style="color: #2563eb; text-decoration: underline;">${resetLink}</a>
                </p>
              </div>

              <!-- Footer Informasi Keamanan -->
              <div style="padding: 20px 25px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280;">
                  Jika Anda tidak merasa meminta perubahan ini, abaikan saja email ini dan kata sandi Anda tidak akan berubah.
                </p>
                <p style="margin: 0; font-size: 11px; color: #9ca3af; font-weight: 500;">
                  &copy; 2026 Sistem Informasi Pelabuhan Benoa. All rights reserved.
                </p>
              </div>

            </div>
          </div>
        `,
        attachments: [
          {
            filename: 'logo-smartberth.png',
            path: path.join(__dirname, '../assets/logo-dermaga-biru.png'),
            cid: 'logo-dermaga-biru'
          }
        ]
      });
    }

    // Always return success (dont reveal whether email exists or not)
    return res.status(200).json({
      success: true,
      data: { message: 'If the email is registered, a reset link has been sent' },
    });
  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    });
  }
}

/**
 * POST /api/auth/reset-password/confirm
 * Confirm password reset request. Validates token and updates password for Agen or Petugas.
 */
async function confirmResetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    let targetTable = null;
    let idColumn = null;
    let userId = null;

    // Check token in master_agen
    const agenCheck = await pool.query(
      'SELECT id_agen FROM master_agen WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (agenCheck.rows.length > 0) {
      targetTable = 'master_agen';
      idColumn = 'id_agen';
      userId = agenCheck.rows[0].id_agen;
    } else {
      // Check token in master_petugas
      const petugasCheck = await pool.query(
        'SELECT id_petugas FROM master_petugas WHERE reset_token = $1 AND reset_token_expires > NOW()',
        [token]
      );
      if (petugasCheck.rows.length > 0) {
        targetTable = 'master_petugas';
        idColumn = 'id_petugas';
        userId = petugasCheck.rows[0].id_petugas;
      }
    }

    // If token is not found in both tables or expired
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token tidak valid atau sudah kadaluarsa' },
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear token in the respective table
    await pool.query(
      `UPDATE ${targetTable} SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE ${idColumn} = $2`,
      [hashedPassword, userId]
    );

    return res.status(200).json({
      success: true,
      data: { message: 'Password berhasil direset' },
    });
  } catch (err) {
    console.error('Confirm reset error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    });
  }
}


/**
 * POST /api/auth/change-password
 * Authenticated user changes their own password. Requires valid JWT token.
 */
async function changePassword(req, res) {
  try {
    // req.user diisi otomatis oleh middleware authenticateToken Anda
    const userId = req.user.id;
    const userRole = req.user.role; 
    const { oldPassword, newPassword } = req.body;

    let targetTable = null;
    let idColumn = null;

    // Tentukan tabel secara dinamis berdasarkan role token user yang sedang login
    if (userRole === 'agen') {
      targetTable = 'master_agen';
      idColumn = 'id_agen';
    } else if (userRole === 'petugas' || userRole === 'admin') {
      targetTable = 'master_petugas';
      idColumn = 'id_petugas';
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role pengguna tidak dikenali' },
      });
    }

    // 1. Ambil password lama dari database untuk dicocokkan
    const result = await pool.query(
      `SELECT password FROM ${targetTable} WHERE ${idColumn} = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' },
      });
    }

    const dbPassword = result.rows[0].password;

    // 2. Verifikasi apakah password lama yang diinput sudah benar
    const isMatch = await bcrypt.compare(oldPassword, dbPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Password saat ini salah' },
      });
    }

    // 3. Hash password baru yang diajukan
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 4. Update password baru ke dalam database & invalidate all access tokens
    //    by incrementing token_version (any outstanding access token with the
    //    old version will be rejected by the auth middleware).
    await pool.query(
      `UPDATE ${targetTable} SET password = $1, token_version = token_version + 1 WHERE ${idColumn} = $2`,
      [hashedPassword, userId]
    );

    // 5. Revoke every active refresh token for this user so other sessions
    //    are forced to re-authenticate with the new password.
    try {
      await RefreshTokenService.revokeAllForUser(userId, userRole);
    } catch (revokeErr) {
      console.error('Failed to revoke refresh tokens after password change:', revokeErr.message);
    }

    return res.status(200).json({
      success: true,
      data: { message: 'Password berhasil diperbarui. Silakan login kembali di semua perangkat.' },
    });
  } catch (err) {
    console.error('Change password error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    });
  }
}


/**
 * POST /api/auth/create-officer
 * Admin creates a Petugas_Operasional account. Requires Admin role.
 */
async function createOfficer(req, res) {
  try {
    const { employee_id, username, password, name, phone_number, email } = req.body;

    // Check if username or employee_id already exists
    const existing = await pool.query(
      'SELECT id_petugas FROM master_petugas WHERE username = $1 OR employee_id = $2',
      [username, employee_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Username or employee ID already exists' },
      });
    }

    // Check if email already exists
    const existingEmail = await pool.query(
      'SELECT id_petugas FROM master_petugas WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Email already registered' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new officer
    let result;
    try {
      result = await pool.query(
        `INSERT INTO master_petugas (employee_id, username, password, name, phone_number, email, user_role)
         VALUES ($1, $2, $3, $4, $5, $6, 'petugas')
         RETURNING id_petugas, employee_id, username, name, phone_number, email, user_role, created_at`,
        [employee_id, username, hashedPassword, name, phone_number || null, email || null]
      );
    } catch (insertErr) {
      if (isDuplicateEmailError(insertErr)) {
        return res.status(409).json({
          success: false,
          error: { code: 'VALIDATION_FIELDS', message: 'Email already registered' },
        });
      }
      throw insertErr;
    }

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Create officer error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    });
  }
}

/**
 * POST /api/auth/create-admin
 * Admin creates another Admin account. Requires Admin role.
 */
async function createAdmin(req, res) {
  try {
    const { employee_id, username, password, name, phone_number, email } = req.body;

    // Check if username or employee_id already exists
    const existing = await pool.query(
      'SELECT id_petugas FROM master_petugas WHERE username = $1 OR employee_id = $2',
      [username, employee_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Username or employee ID already exists' },
      });
    }

    // Check if email already exists
    const existingEmail = await pool.query(
      'SELECT id_petugas FROM master_petugas WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'Email already registered' },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new admin
    let result;
    try {
      result = await pool.query(
        `INSERT INTO master_petugas (employee_id, username, password, name, phone_number, email, user_role)
         VALUES ($1, $2, $3, $4, $5, $6, 'admin')
         RETURNING id_petugas, employee_id, username, name, phone_number, email, user_role, created_at`,
        [employee_id, username, hashedPassword, name, phone_number || null, email || null]
      );
    } catch (insertErr) {
      if (isDuplicateEmailError(insertErr)) {
        return res.status(409).json({
          success: false,
          error: { code: 'VALIDATION_FIELDS', message: 'Email already registered' },
        });
      }
      throw insertErr;
    }

    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Create admin error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    });
  }
}

/**
 * GET /api/auth/me
 * Get the full profile of the currently authenticated user.
 */
async function getProfile(req, res) {
  try {
    const { id, userType } = req.user;

    let profile = null;

    if (userType === 'agen') {
      const result = await pool.query(
        `SELECT id_agen, username, agency_name, npwp, company_address, phone_number, email, created_at
         FROM master_agen WHERE id_agen = $1`,
        [id]
      );
      if (result.rows.length > 0) {
        const a = result.rows[0];
        profile = {
          id: a.id_agen,
          role: 'agen',
          userType: 'agen',
          username: a.username,
          agency_name: a.agency_name,
          npwp: a.npwp,
          company_address: a.company_address,
          phone_number: a.phone_number,
          email: a.email,
          created_at: a.created_at,
        };
      }
    } else {
      const result = await pool.query(
        `SELECT id_petugas, employee_id, username, name, phone_number, user_role, created_at
         FROM master_petugas WHERE id_petugas = $1`,
        [id]
      );
      if (result.rows.length > 0) {
        const p = result.rows[0];
        profile = {
          id: p.id_petugas,
          role: p.user_role,
          userType: 'petugas',
          username: p.username,
          employee_id: p.employee_id,
          name: p.name,
          phone_number: p.phone_number,
          created_at: p.created_at,
        };
      }
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User profile not found' },
      });
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error('Get profile error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    });
  }
}

/**
 * POST /api/auth/refresh
 * Rotate refresh token: validate the old token, revoke it, issue a new pair.
 * Refresh tokens are single-use (rotation). A stolen+used refresh token
 * immediately invalidates the legitimate user's chain.
 */
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;

    const { payload, newAccessToken, newRefreshToken } = await RefreshTokenService.rotate(refreshToken);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: payload.id,
          username: payload.username,
          role: payload.role,
          userType: payload.userType,
        },
      },
    });
  } catch (err) {
    // TokenError from RefreshTokenService carries a clean code
    if (err && err.code === 'AUTH_INVALID') {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_INVALID', message: err.message },
      });
    }
    if (err && err.code === 'AUTH_EXPIRED') {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_EXPIRED', message: err.message },
      });
    }
    console.error('Error refreshing token:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  }
}

/**
 * POST /api/auth/logout
 * Revoke the supplied refresh token (single-device logout).
 * Requires a valid access token (authenticateToken) so that only the
 * owner of the session can revoke its refresh token.
 */
async function logout(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Refresh token required' },
      });
    }

    await RefreshTokenService.revoke(refreshToken);

    return res.status(200).json({
      success: true,
      data: { message: 'Logged out' },
    });
  } catch (err) {
    console.error('Logout error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  }
}

module.exports = {
  register,
  login,
  resetPassword,
  confirmResetPassword,
  changePassword,
  createOfficer,
  createAdmin,
  refreshToken,
  logout,
  getProfile,
  generateAccessToken,
  verifyRecaptcha,
};
