const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      required: true,
      enum: ['Percentage', 'Fixed'],
      default: 'Percentage',
    },
    discountValue: {
      type: Number,
      required: true,
      min: [0, 'Discount value cannot be negative'],
    },
    applicableProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false, // Optional: if empty, applies to any product
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiryDate: {
      type: Date,
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

CouponSchema.index({ code: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Coupon', CouponSchema);
