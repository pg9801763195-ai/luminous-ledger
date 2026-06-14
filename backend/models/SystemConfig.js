const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema(
  {
    announcement: {
      type: String,
      default: '',
    },
    planLimits: {
      Basic: {
        staffLimit: { type: Number, default: 3 },
        waMarketingEnabled: { type: Boolean, default: false }
      },
      Premium: {
        staffLimit: { type: Number, default: 5 },
        waMarketingEnabled: { type: Boolean, default: true }
      },
      Enterprise: {
        staffLimit: { type: Number, default: 9999 }, // effectively unlimited
        waMarketingEnabled: { type: Boolean, default: true }
      }
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
