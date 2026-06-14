const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAnalyticsReport,
} = require('../controllers/reportController');
const { protect, checkRole, checkPermission } = require('../middleware/auth');

router.get('/dashboard', protect, getDashboardStats);
router.get('/analytics', protect, checkPermission('reports'), getAnalyticsReport);

module.exports = router;
