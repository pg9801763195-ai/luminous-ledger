const express = require('express');
const router = express.Router();
const { 
  getTenants, 
  createTenant, 
  updateTenant, 
  deleteTenant,
  impersonateUser,
  getSystemLogs,
  getSystemAnalytics,
  getSystemConfig,
  updateSystemConfig,
  getRateLimits,
  deleteRateLimit
} = require('../controllers/saasController');
const { protect, checkSuperAdmin } = require('../middleware/auth');

// All routes require authentication and SuperAdmin role
router.use(protect);
router.use(checkSuperAdmin);

router.route('/tenants')
  .get(getTenants)
  .post(createTenant);

router.route('/tenants/:id')
  .put(updateTenant)
  .delete(deleteTenant);

router.route('/impersonate/:userId')
  .post(impersonateUser);

router.route('/logs')
  .get(getSystemLogs);

router.route('/analytics')
  .get(getSystemAnalytics);

router.route('/config')
  .get(getSystemConfig)
  .put(updateSystemConfig);

router.route('/rate-limits')
  .get(getRateLimits);

router.route('/rate-limits/:id')
  .delete(deleteRateLimit);

module.exports = router;
