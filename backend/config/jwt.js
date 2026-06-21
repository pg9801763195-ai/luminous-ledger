const crypto = require('crypto');

// Generate a random key once on server startup as a secure fallback
const fallbackSecret = crypto.randomBytes(32).toString('hex');

module.exports = process.env.JWT_SECRET || fallbackSecret;
