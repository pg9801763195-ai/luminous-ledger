const RateLimit = require('../models/RateLimit');

const getClientIp = (req) => {
  return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
};

// General API rate limiter (100 requests per 10 minutes per IP)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_API_REQUESTS = 100;

exports.apiRateLimiter = async (req, res, next) => {
  const ip = getClientIp(req);
  const key = `api:ip:${ip}`;
  
  try {
    const now = Date.now();
    // Use atomic findOneAndUpdate to increment points
    const limitDoc = await RateLimit.findOneAndUpdate(
      { key },
      { 
        $inc: { points: 1 },
        $setOnInsert: { expireAt: new Date(now + WINDOW_MS) }
      },
      { upsert: true, new: true }
    );

    if (limitDoc.points > MAX_API_REQUESTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again after 10 minutes.',
      });
    }

    next();
  } catch (error) {
    console.error('API Rate Limiter error:', error);
    // Fail-open for rate limiting to ensure server availability if database is slow
    next();
  }
};

// Strict Login rate limiter (5 attempts per 10 minutes)
const MAX_LOGIN_ATTEMPTS = 5;

exports.loginRateLimiter = async (req, res, next) => {
  const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
  const ip = getClientIp(req);

  // SuperAdmin is completely exempt from rate limiting to prevent lockouts
  if (email === 'superadmin@luminous.com') {
    return next();
  }

  try {
    const keys = [];
    if (email) keys.push(`login:email:${email}`);
    keys.push(`login:ip:${ip}`);

    // Check if either the email or IP is blocked
    const activeBlocks = await RateLimit.find({
      key: { $in: keys },
      points: { $gte: MAX_LOGIN_ATTEMPTS }
    });

    if (activeBlocks.length > 0) {
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again after 10 minutes or contact SuperAdmin to reset your limit.',
      });
    }

    next();
  } catch (error) {
    console.error('Login Rate Limiter error:', error);
    next();
  }
};

// Increment login failure points
exports.recordLoginFailure = async (email, ip) => {
  const now = Date.now();
  const expireAt = new Date(now + WINDOW_MS);

  try {
    const operations = [];
    if (email) {
      const emailKey = `login:email:${email.trim().toLowerCase()}`;
      operations.push(
        RateLimit.findOneAndUpdate(
          { key: emailKey },
          { 
            $inc: { points: 1 },
            $setOnInsert: { expireAt }
          },
          { upsert: true }
        )
      );
    }

    const ipKey = `login:ip:${ip}`;
    operations.push(
      RateLimit.findOneAndUpdate(
        { key: ipKey },
        { 
          $inc: { points: 1 },
          $setOnInsert: { expireAt }
        },
        { upsert: true }
      )
    );

    await Promise.all(operations);
  } catch (error) {
    console.error('Failed to record login failure:', error);
  }
};

// Clear login rate limits upon successful login
exports.recordLoginSuccess = async (email, ip) => {
  try {
    const keys = [`login:ip:${ip}`];
    if (email) {
      keys.push(`login:email:${email.trim().toLowerCase()}`);
    }
    await RateLimit.deleteMany({ key: { $in: keys } });
  } catch (error) {
    console.error('Failed to clear login success rate limits:', error);
  }
};
