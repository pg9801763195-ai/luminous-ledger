const express = require('express');
const router = express.Router();
const {
  login,
  getMe,
  registerStaff,
  getStaff,
  updateStaff,
  deleteStaff,
} = require('../controllers/authController');
const { protect, checkRole, checkPermission } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', protect, getMe);

// Staff management (Admin only)
router.route('/staff')
  .post(protect, checkPermission('settings'), registerStaff)
  .get(protect, checkPermission('settings'), getStaff);

router.route('/staff/:id')
  .put(protect, checkPermission('settings'), updateStaff)
  .delete(protect, checkPermission('settings'), deleteStaff);

module.exports = router;
