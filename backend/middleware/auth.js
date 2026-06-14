const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// In-memory cache to throttle tenant lookup queries (TTL: 10s)
const tenantStatusCache = new Map();

// Protect routes - JWT validation
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_luminous_key_12345_67890');

      // Get user from the token, exclude password
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found in system' });
      }

      if (!req.user.active) {
        return res.status(401).json({ success: false, message: 'User account has been deactivated' });
      }

      // If user is not SuperAdmin, verify their Tenant status
      if (req.user.role !== 'SuperAdmin') {
        const tenantId = req.user.tenant.toString();
        const now = Date.now();
        const cached = tenantStatusCache.get(tenantId);

        let tenantStatus;
        if (cached && now - cached.timestamp < 10000) {
          tenantStatus = cached.status;
        } else {
          const Tenant = require('../models/Tenant');
          const tenant = await Tenant.findById(req.user.tenant);
          if (!tenant) {
            return res.status(401).json({ success: false, message: 'Tenant store not found in system' });
          }
          tenantStatus = tenant.status;
          tenantStatusCache.set(tenantId, { status: tenantStatus, timestamp: now });
        }

        if (tenantStatus === 'Suspended') {
          return res.status(403).json({ success: false, message: 'Your store account has been suspended. Please contact SaaS Administrator.' });
        }
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

// Limit routes to specific roles
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user.role}) is not authorized to access this resource`,
      });
    }

    next();
  };
};

// Limit routes to specific permissions
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Admin override - Admins can do anything
    if (req.user.role === 'Admin') {
      return next();
    }

    // Helper for fallback default permissions for legacy database records
    const getDefaultPermissions = (role) => {
      if (role === 'Admin') {
        return [
          'dashboard',
          'billing',
          'returns',
          'products',
          'inventory',
          'coupons',
          'broadcast',
          'customers',
          'suppliers',
          'reports',
          'settings',
        ];
      }
      if (role === 'Manager') {
        return [
          'dashboard',
          'billing',
          'returns',
          'products',
          'inventory',
          'coupons',
          'broadcast',
          'customers',
          'suppliers',
          'reports',
        ];
      }
      return ['dashboard', 'billing', 'returns'];
    };

    const userPermissions = req.user.permissions && req.user.permissions.length > 0
      ? req.user.permissions
      : getDefaultPermissions(req.user.role);

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have the required permission (${permission}) to access this resource`,
      });
    }

    next();
  };
};

// Utility to create audit trails/activity logs
const logActivity = async (userId, action, details, req = null) => {
  try {
    const ipAddress = req ? req.ip || req.connection.remoteAddress : '';
    let tenant = null;
    if (req && req.user) {
      tenant = req.user.tenant;
    } else if (userId) {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (user) {
        tenant = user.tenant;
      }
    }
    await ActivityLog.create({
      user: userId,
      tenant,
      action,
      details,
      ipAddress,
    });
  } catch (error) {
    console.error(`Error logging activity: ${error.message}`);
  }
};

// Restrict routes to Super-Admin only
const checkSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Super-Admin access required',
    });
  }

  next();
};

module.exports = { protect, checkRole, checkPermission, logActivity, checkSuperAdmin };



