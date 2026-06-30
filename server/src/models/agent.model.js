const pool = require('../config/db');

/**
 * Agent (master_agen) model with parameterized queries.
 */
const AgentModel = {
  /**
   * Get all agents.
   */
  async findAll() {
    const result = await pool.query(
      `SELECT id_agen, username, agency_name, npwp, company_address, 
              phone_number, email, created_at 
       FROM master_agen 
       ORDER BY id_agen ASC`
    );
    return result.rows;
  },

  /**
   * Find an agent by ID.
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT id_agen, username, agency_name, npwp, company_address, 
              phone_number, email, created_at 
       FROM master_agen 
       WHERE id_agen = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update an agent by ID (does not update password).
   */
  async update(id, { username, agency_name, npwp, company_address, phone_number, email }) {
    const result = await pool.query(
      `UPDATE master_agen 
       SET username = $1, agency_name = $2, npwp = $3, 
           company_address = $4, phone_number = $5, email = $6 
       WHERE id_agen = $7 
       RETURNING id_agen, username, agency_name, npwp, company_address, 
                 phone_number, email, created_at`,
      [username, agency_name, npwp || null, company_address || null, phone_number || null, email || null, id]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete an agent by ID.
   */
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM master_agen WHERE id_agen = $1 RETURNING id_agen, username, agency_name',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Check if an agent has any associated ships.
   */
  async hasShips(id) {
    const result = await pool.query(
      'SELECT COUNT(*) AS count FROM master_kapal WHERE id_agen = $1',
      [id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  },

  /**
   * Check if an agent has any associated bookings.
   */
  async hasBookings(id) {
    const result = await pool.query(
      'SELECT COUNT(*) AS count FROM trx_booking WHERE id_agen = $1',
      [id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  },

  /**
   * Check if username already exists (for another agent).
   */
  async usernameExists(username, excludeId = null) {
    let query = 'SELECT COUNT(*) AS count FROM master_agen WHERE username = $1';
    const params = [username];
    if (excludeId) {
      query += ' AND id_agen != $2';
      params.push(excludeId);
    }
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10) > 0;
  },
};

module.exports = AgentModel;
