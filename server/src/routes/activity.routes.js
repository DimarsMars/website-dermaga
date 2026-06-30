const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/activity
 * Get activity logs (filtered by role: agents see own, officers/admin see all).
 * Query params: startDate, endDate, activityType
 */
router.get(
  '/',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  activityController.getActivityLogs
);

/**
 * GET /api/activity/export/pdf
 * Export filtered activity history as PDF download.
 * Query params: startDate, endDate, activityType
 */
router.get(
  '/export/pdf',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  activityController.exportPDF
);

module.exports = router;
