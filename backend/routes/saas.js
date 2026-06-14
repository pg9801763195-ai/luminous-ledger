const express = require('express');
const router = express.Router();
const { 
  getTenants, 
  createTenant, 
  updateTenant, 
  impersonateUser,
  getSystemLogs,
  getSystemAnalytics,
  getSystemConfig,
  updateSystemConfig
} = require('../controllers/saasController');
const { protect, checkSuperAdmin } = require('../middleware/auth');

// All routes require authentication and SuperAdmin role
router.use(protect);
router.use(checkSuperAdmin);

router.route('/tenants')
  .get(getTenants)
  .post(createTenant);

router.route('/tenants/:id')
  .put(updateTenant);

router.route('/impersonate/:userId')
  .post(impersonateUser);

router.route('/logs')
  .get(getSystemLogs);

router.route('/analytics')
  .get(getSystemAnalytics);

router.route('/config')
  .get(getSystemConfig)
  .put(updateSystemConfig);

module.exports = router;
