const pool = require('../config/db');

/**
 * Ship (master_kapal) model with parameterized queries.
 */
const ShipModel = {
  /**
   * Get all ships. If agentId is provided, filter by agent ownership.
   */
  async findAll(agentId = null) {
    if (agentId) {
      const result = await pool.query(
        `SELECT mk.*, ma.agency_name 
         FROM master_kapal mk 
         JOIN master_agen ma ON mk.id_agen = ma.id_agen 
         WHERE mk.id_agen = $1 
         ORDER BY mk.id_kapal ASC`,
        [agentId]
      );
      return result.rows;
    }
    const result = await pool.query(
      `SELECT mk.*, ma.agency_name 
       FROM master_kapal mk 
       JOIN master_agen ma ON mk.id_agen = ma.id_agen 
       ORDER BY mk.id_kapal ASC`
    );
    return result.rows;
  },

  /**
   * Find a ship by ID.
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT mk.*, ma.agency_name 
       FROM master_kapal mk 
       JOIN master_agen ma ON mk.id_agen = ma.id_agen 
       WHERE mk.id_kapal = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new ship.
   */
  async create({ nama_kapal, loa, gt, id_agen, keterangan, type, call_sign }) {
    const result = await pool.query(
      `INSERT INTO master_kapal (nama_kapal, loa, gt, id_agen, keterangan, type, call_sign) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [nama_kapal, loa, gt || null, id_agen, keterangan || null, type || null, call_sign || null]
    );
    return result.rows[0];
  },

  /**
   * Update a ship by ID.
   */
  async update(id, { nama_kapal, loa, gt, id_agen, keterangan, type, call_sign }) {
    const result = await pool.query(
      `UPDATE master_kapal 
       SET nama_kapal = $1, loa = $2, gt = $3, id_agen = $4, keterangan = $5, type = $6, call_sign = $7 
       WHERE id_kapal = $8 
       RETURNING *`,
      [nama_kapal, loa, gt || null, id_agen, keterangan || null, type || null, call_sign || null, id]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a ship by ID.
   */
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM master_kapal WHERE id_kapal = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Check if a ship has any associated bookings.
   */
  async hasBookings(id) {
    const result = await pool.query(
      'SELECT COUNT(*) AS count FROM trx_booking WHERE id_kapal = $1',
      [id]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  },
};

module.exports = ShipModel;
