const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityController');
const { protect, checkRole, checkPermission } = require('../middleware/auth');

router.get('/', protect, checkPermission('settings'), getActivityLogs);

module.exports = router;
