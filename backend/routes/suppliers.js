const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require('../controllers/supplierController');
const { protect, checkRole, checkPermission } = require('../middleware/auth');

router.route('/')
  .get(protect, getSuppliers)
  .post(protect, checkPermission('suppliers'), createSupplier);

router.route('/:id')
  .put(protect, checkPermission('suppliers'), updateSupplier)
  .delete(protect, checkPermission('suppliers'), deleteSupplier);

module.exports = router;
