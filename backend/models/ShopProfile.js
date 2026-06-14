const mongoose = require('mongoose');

const ShopProfileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'Retail Store',
    },
    logo: {
      type: String,
      default: '', // base64 Data URL or path
    },
    gstin: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    receiptBaseUrl: {
      type: String,
      default: '',
    },
    metaApiEnabled: {
      type: Boolean,
      default: false,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ShopProfile', ShopProfileSchema);
