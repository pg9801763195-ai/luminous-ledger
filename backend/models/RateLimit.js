const mongoose = require('mongoose');

const RateLimitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    points: {
      type: Number,
      required: true,
      default: 0,
    },
    expireAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically remove documents after expireAt date
RateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RateLimit', RateLimitSchema);
