const express = require('express');
const router = express.Router();
const masterController = require('../controllers/master.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// ============================================================
// Ship Routes
// ============================================================

/**
 * GET /api/ships
 * List ships. Agents see only their own ships; petugas/admin see all.
 */
router.get(
  '/ships',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  masterController.getShips
);

/**
 * POST /api/ships
 * Create a new ship (Admin only).
 */
router.post(
  '/ships',
  authenticateToken,
  authorize('admin'),
  masterController.createShip
);

/**
 * PUT /api/ships/:id
 * Update a ship (Admin only).
 */
router.put(
  '/ships/:id',
  authenticateToken,
  authorize('admin'),
  masterController.updateShip
);

/**
 * DELETE /api/ships/:id
 * Delete a ship (Admin only, no bookings).
 */
router.delete(
  '/ships/:id',
  authenticateToken,
  authorize('admin'),
  masterController.deleteShip
);

// ============================================================
// Agent Routes
// ============================================================

/**
 * GET /api/agents
 * List all agents (Petugas/Admin — needed for manual booking form).
 */
router.get(
  '/agents',
  authenticateToken,
  authorize('petugas', 'admin'),
  masterController.getAgents
);

/**
 * PUT /api/agents/:id
 * Update an agent (Admin only).
 */
router.put(
  '/agents/:id',
  authenticateToken,
  authorize('admin'),
  masterController.updateAgent
);

/**
 * DELETE /api/agents/:id
 * Delete an agent (Admin only).
 */
router.delete(
  '/agents/:id',
  authenticateToken,
  authorize('admin'),
  masterController.deleteAgent
);

// ============================================================
// Officer Routes
// ============================================================

/**
 * GET /api/officers
 * List all officers (Admin only).
 */
router.get(
  '/officers',
  authenticateToken,
  authorize('admin'),
  masterController.getOfficers
);

/**
 * PUT /api/officers/:id
 * Update an officer (Admin only).
 */
router.put(
  '/officers/:id',
  authenticateToken,
  authorize('admin'),
  masterController.updateOfficer
);

/**
 * DELETE /api/officers/:id
 * Delete an officer (Admin only).
 */
router.delete(
  '/officers/:id',
  authenticateToken,
  authorize('admin'),
  masterController.deleteOfficer
);

module.exports = router;
