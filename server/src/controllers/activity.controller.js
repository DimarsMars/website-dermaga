const { ActivityService } = require('../services/activity.service');
const { generateActivityPDF } = require('../utils/pdf');

/**
 * Activity controller handling HTTP request/response for activity log operations.
 */
const activityController = {
  /**
   * GET /api/activity
   * Get activity logs filtered by role and optional query params.
   * Query params: startDate, endDate, activityType
   */
  async getActivityLogs(req, res) {
    try {
      const { startDate, endDate, activityType, bookingId } = req.query;

      const logs = await ActivityService.getActivityLogs(req.user, {
        startDate,
        endDate,
        activityType,
        bookingId,
      });

      return res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * GET /api/activity/export/pdf
   * Generate and stream a PDF of filtered activity logs.
   * Query params: startDate, endDate, activityType
   */
  async exportPDF(req, res) {
    try {
      const { startDate, endDate, activityType } = req.query;

      const logs = await ActivityService.getActivityLogs(req.user, {
        startDate,
        endDate,
        activityType,
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="activity-log.pdf"'
      );

      const pdfStream = generateActivityPDF(logs, {
        title: 'Activity Log Report',
        startDate,
        endDate,
      });

      // Pipe the PDF stream to the response
      pdfStream.pipe(res);
    } catch (err) {
      console.error('Error exporting activity PDF:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },
};

module.exports = activityController;
