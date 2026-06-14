const express = require('express');
const router = express.Router();
const { protect, checkRole } = require('../middleware/auth');
const { getShopProfile, updateShopProfile, getPublicShopProfile } = require('../controllers/shopController');

// Get public shop details (No login required)
router.get('/public', getPublicShopProfile);

router.use(protect);

// Get the shop profile (Staff can see it)
router.get('/', getShopProfile);

// Update shop profile (Manager/Admin only)
router.put('/', checkRole(['Admin', 'Manager']), updateShopProfile);

module.exports = router;
