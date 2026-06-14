const express = require('express');
const router = express.Router();
const { protect, checkRole, checkPermission } = require('../middleware/auth');
const {
  createCoupon,
  getCoupons,
  deleteCoupon,
  validateCoupon,
} = require('../controllers/couponController');

// All coupon routes require login
router.use(protect);

// Validate a coupon (used in POS checkout billing)
router.get('/validate/:code', validateCoupon);

// Get all coupons
router.get('/', getCoupons);

// Manager/Admin can create and delete coupons
router.post('/', checkPermission('coupons'), createCoupon);
router.delete('/:id', checkPermission('coupons'), deleteCoupon);

module.exports = router;
