const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  adjustStock,
  deleteProduct,
  getInventoryLogs,
} = require('../controllers/productController');
const { protect, checkRole, checkPermission } = require('../middleware/auth');

router.route('/')
  .get(protect, getProducts)
  .post(protect, checkPermission('products'), createProduct);

router.get('/logs/history', protect, checkPermission('inventory'), getInventoryLogs);

router.route('/:id')
  .get(protect, getProduct)
  .put(protect, checkPermission('products'), updateProduct)
  .delete(protect, checkPermission('products'), deleteProduct);

router.put('/:id/adjust-stock', protect, checkPermission('products'), adjustStock);

module.exports = router;
