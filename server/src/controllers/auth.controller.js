const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const SALT_ROUNDS = 12;

/**
 * Generate access token (15 min) and refresh token (7 days).
 */
function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

/**
 * Verify Google reCAPTCHA token server-side.
 */
async function verifyRecaptcha(token) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    // Skip verification if secret key is not configured (development)
    return true;
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
    return data.success === true;
  } catch (err) {
    console.error('reCAPTCHA verification error:', err.message);
    return false;
  }
}

/**
 * POST /api/auth/register
 * Agent (Agen_Kapal) registration.
 */
async function register(req, res) {
  try {
    const { username, password, agency_name, npwp, company_address, phone_number, email, recaptchaToken } = req.body;

    // Verify reCAPTCHA
    if (recaptchaToken) {
      const captchaValid = await verifyRecaptcha(recaptchaToken);
      if (!captchaValid) {
        return res.status(400).json({
          success: false,
          error: { code: 'RECAPTCHA_FAILED', message: 'reCAPTCHA verification failed' },
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new agent
    const result = await pool.query(
      `INSERT INTO master_agen (username, password, agency_name, npwp, company_address, phone_number, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_agen, username, agency_name, email, created_at`,
      [username, hashedPassword, agency_name, npwp || null, company_address || null, phone_number || null, email || null]
    );

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

    // Verify reCAPTCHA
    if (recaptchaToken) {
      const captchaValid = await verifyRecaptcha(recaptchaToken);
      if (!captchaValid) {
        return res.status(400).json({
          success: false,
          error: { code: 'RECAPTCHA_FAILED', message: 'reCAPTCHA verification failed' },
        });
      }
    }

    // Try to find user in master_agen first
    let user = null;
    let userType = null;
    let role = null;
    let userId = null;

    const agenResult = await pool.query(
      'SELECT id_agen, username, password FROM master_agen WHERE username = $1',
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
        'SELECT id_petugas, username, password, user_role FROM master_petugas WHERE username = $1',
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

    // Generate JWT tokens
    const tokenPayload = {
      id: userId,
      username: user.username,
      role,
      userType,
    };
    const { accessToken, refreshToken } = generateTokens(tokenPayload);

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

    // 4. Update password baru ke dalam database
    await pool.query(
      `UPDATE ${targetTable} SET password = $1 WHERE ${idColumn} = $2`,
      [hashedPassword, userId]
    );

    return res.status(200).json({
      success: true,
      data: { message: 'Password berhasil diperbarui' },
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new officer
    const result = await pool.query(
      `INSERT INTO master_petugas (employee_id, username, password, name, phone_number, email, user_role)
       VALUES ($1, $2, $3, $4, $5, $6, 'petugas')
       RETURNING id_petugas, employee_id, username, name, phone_number, email, user_role, created_at`,
      [employee_id, username, hashedPassword, name, phone_number || null, email || null]
    );

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
    const { employee_id, username, password, name, phone_number } = req.body;

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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new admin
    const result = await pool.query(
      `INSERT INTO master_petugas (employee_id, username, password, name, phone_number, user_role)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       RETURNING id_petugas, employee_id, username, name, phone_number, user_role, created_at`,
      [employee_id, username, hashedPassword, name, phone_number || null]
    );

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
 * Refresh access token using a valid refresh token.
 */
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Refresh token required' },
      });
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_EXPIRED', message: 'Refresh token expired or invalid' },
      });
    }

    // Generate new tokens
    const payload = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      userType: decoded.userType,
    };

    const tokens = generateTokens(payload);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (err) {
    console.error('Error refreshing token:', err);
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
  getProfile,
  generateTokens,
  verifyRecaptcha,
};
