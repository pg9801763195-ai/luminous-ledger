const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  createInvoice,
  refundInvoice,
  generateInvoicePDF,
  returnOrExchangeItems,
} = require('../controllers/invoiceController');
const { protect, checkRole } = require('../middleware/auth');

router.route('/')
  .get(protect, getInvoices)
  .post(protect, createInvoice);

router.route('/:id')
  .get(protect, getInvoice);

router.post('/:id/refund', protect, checkRole(['Admin', 'Manager']), refundInvoice);
router.post('/:id/return', protect, returnOrExchangeItems);
router.get('/:id/pdf', protect, generateInvoicePDF);
router.get('/public/:shareToken/pdf', generateInvoicePDF);

module.exports = router;
