const express = require('express');
const router = express.Router();
const { sendBroadcast } = require('../controllers/marketingController');
const { protect, checkRole, checkPermission } = require('../middleware/auth');

router.use(protect);
router.use(checkPermission('broadcast'));

// Send WhatsApp simulated broadcast campaign
router.post('/broadcast', sendBroadcast);

module.exports = router;
