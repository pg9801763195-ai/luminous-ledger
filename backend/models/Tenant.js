const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a tenant name'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Please add a tenant subdomain slug'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended'],
      default: 'Active',
    },
    plan: {
      type: String,
      enum: ['Basic', 'Premium', 'Enterprise'],
      default: 'Basic',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Tenant', TenantSchema);
