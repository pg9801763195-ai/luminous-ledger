const failedLoginsStore = new Map();

// Configuration: Block after 10 failed login attempts in 15 minutes
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 10;

const getClientIp = (req) => {
  return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
};

// Rate limiting middleware for failed login attempts
exports.loginRateLimiter = (req, res, next) => {
  const ip = getClientIp(req);
  const now = Date.now();
  
  if (failedLoginsStore.has(ip)) {
    const record = failedLoginsStore.get(ip);
    
    // If window expired, clear the record
    if (now > record.resetTime) {
      failedLoginsStore.delete(ip);
      return next();
    }
    
    // If failed attempts exceeded the max, block the request
    if (record.count >= MAX_FAILED_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed login attempts from this IP. Please try again after 15 minutes.'
      });
    }
  }
  
  next();
};

// Register a successful login (resets the counter)
exports.registerLoginSuccess = (req) => {
  const ip = getClientIp(req);
  failedLoginsStore.delete(ip);
};

// Register a failed login (increments the counter)
exports.registerLoginFailure = (req) => {
  const ip = getClientIp(req);
  const now = Date.now();
  
  if (!failedLoginsStore.has(ip)) {
    failedLoginsStore.set(ip, { count: 1, resetTime: now + WINDOW_MS });
  } else {
    const record = failedLoginsStore.get(ip);
    if (now > record.resetTime) {
      // Window expired, reset record
      failedLoginsStore.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    } else {
      record.count += 1;
    }
  }
};
