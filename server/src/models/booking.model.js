const pool = require('../config/db');

/**
 * Booking (trx_booking) model with parameterized queries.
 */
const BookingModel = {
  /**
   * Create a new booking.
   * @param {object} data - Booking data
   * @param {object} [client] - Optional pg client for transaction support
   * @returns {object} Created booking row
   */
  async create({ id_kapal, id_agen, pos_start, pos_end, eta_in, etd_out, pbm, keterangan, status_request }, client = null) {
    const executor = client || pool;
    const result = await executor.query(
      `INSERT INTO trx_booking (id_kapal, id_agen, pos_start, pos_end, eta_in, etd_out, pbm, keterangan, status_request)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id_kapal, id_agen, pos_start, pos_end, eta_in, etd_out, pbm || null, keterangan || null, status_request]
    );
    return result.rows[0];
  },

  /**
   * Find all bookings with ship join.
   * If agentId is provided, filter by agent ownership.
   * @param {number|null} agentId - Optional agent ID filter
   * @returns {Array} List of bookings
   */
  async findAll(agentId = null) {
    let query = `
      SELECT tb.*, mk.nama_kapal, mk.loa, mk.gt, ma.agency_name
      FROM trx_booking tb
      JOIN master_kapal mk ON tb.id_kapal = mk.id_kapal
      LEFT JOIN master_agen ma ON tb.id_agen = ma.id_agen
    `;
    const params = [];

    if (agentId) {
      query += ' WHERE tb.id_agen = $1';
      params.push(agentId);
    }

    query += ' ORDER BY tb.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Find a single booking by ID with ship join.
   * @param {number} id - Booking ID
   * @returns {object|null} Booking row or null
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT tb.*, mk.nama_kapal, mk.loa, mk.gt, ma.agency_name
       FROM trx_booking tb
       JOIN master_kapal mk ON tb.id_kapal = mk.id_kapal
       LEFT JOIN master_agen ma ON tb.id_agen = ma.id_agen
       WHERE tb.id_booking = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update booking status.
   * @param {number} id - Booking ID
   * @param {string} status - New status ('approved' | 'rejected')
   * @param {object} [client] - Optional pg client for transaction support
   * @returns {object|null} Updated booking row or null
   */
  async updateStatus(id, status, client = null) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE trx_booking
       SET status_request = $1, updated_at = NOW()
       WHERE id_booking = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update booking position (pos_start and pos_end).
   * @param {number} id - Booking ID
   * @param {number} posStart - New starting position
   * @param {number} posEnd - New ending position
   * @param {object} [client] - Optional pg client for transaction support
   * @returns {object|null} Updated booking row or null
   */
  async updatePosition(id, posStart, posEnd, client = null) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE trx_booking
       SET pos_start = $1, pos_end = $2, updated_at = NOW()
       WHERE id_booking = $3
       RETURNING *`,
      [posStart, posEnd, id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update booking departure time (etd_out) for extend time.
   * @param {number} id - Booking ID
   * @param {string} newEtdOut - New departure datetime (ISO 8601)
   * @param {object} [client] - Optional pg client for transaction support
   * @returns {object|null} Updated booking row or null
   */
  async updateEtdOut(id, newEtdOut, client = null) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE trx_booking
       SET etd_out = $1, updated_at = NOW()
       WHERE id_booking = $2
       RETURNING *`,
      [newEtdOut, id]
    );
    return result.rows[0] || null;
  },

  /**
   * Full update of a booking record.
   * @param {number} id - Booking ID
   * @param {object} data - Updated booking fields
   * @param {object} [client] - Optional pg client for transaction support
   * @returns {object|null} Updated booking row or null
   */
  async updateFull(id, { id_kapal, id_agen, pos_start, pos_end, eta_in, etd_out, pbm, keterangan, status, status_request }, client = null) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE trx_booking
       SET id_kapal = $1, id_agen = $2, pos_start = $3, pos_end = $4,
           eta_in = $5, etd_out = $6, pbm = $7, keterangan = $8,
           status = $9, status_request = $10, updated_at = NOW()
       WHERE id_booking = $11
       RETURNING *`,
      [id_kapal, id_agen, pos_start, pos_end, eta_in, etd_out, pbm || null, keterangan || null, status || 'inactive', status_request || 'pending', id]
    );
    return result.rows[0] || null;
  },
};

module.exports = BookingModel;
