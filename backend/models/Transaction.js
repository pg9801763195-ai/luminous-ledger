const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    transactionNumber: {
      type: String,
      required: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: false,
    },
    type: {
      type: String,
      enum: ['Sale', 'Purchase', 'Refund', 'Adjustment'],
      required: true,
    },
    category: {
      type: String,
      enum: ['Income', 'Expense'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      default: 'Cash',
    },
    referenceId: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

TransactionSchema.index({ transactionNumber: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
