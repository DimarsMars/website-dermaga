const pool = require('../config/db');

/**
 * Officer (master_petugas) model with parameterized queries.
 */
const OfficerModel = {
  /**
   * Get all officers.
   */
  async findAll() {
    const result = await pool.query(
      `SELECT id_petugas, employee_id, username, name, phone_number, 
              email, user_role, created_at 
       FROM master_petugas 
       ORDER BY id_petugas ASC`
    );
    return result.rows;
  },

  /**
   * Find an officer by ID.
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT id_petugas, employee_id, username, name, phone_number, 
              user_role, created_at 
       FROM master_petugas 
       WHERE id_petugas = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update an officer by ID (does not update password).
   */
  async update(id, { employee_id, username, name, phone_number, email, user_role }) {
    const result = await pool.query(
      `UPDATE master_petugas 
       SET employee_id = $1, username = $2, name = $3, 
           phone_number = $4, user_role = $5, email = $6 
       WHERE id_petugas = $7 
       RETURNING id_petugas, employee_id, username, name, phone_number, 
                 email, user_role, created_at`,
      [employee_id, username, name, phone_number || null, user_role, email || null, id]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete an officer by ID.
   */
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM master_petugas WHERE id_petugas = $1 RETURNING id_petugas, username, name',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Check if employee_id already exists (for another officer).
   */
  async employeeIdExists(employeeId, excludeId = null) {
    let query = 'SELECT COUNT(*) AS count FROM master_petugas WHERE employee_id = $1';
    const params = [employeeId];
    if (excludeId) {
      query += ' AND id_petugas != $2';
      params.push(excludeId);
    }
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10) > 0;
  },

  /**
   * Check if username already exists (for another officer).
   */
  async usernameExists(username, excludeId = null) {
    let query = 'SELECT COUNT(*) AS count FROM master_petugas WHERE username = $1';
    const params = [username];
    if (excludeId) {
      query += ' AND id_petugas != $2';
      params.push(excludeId);
    }
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10) > 0;
  },
};

module.exports = OfficerModel;
