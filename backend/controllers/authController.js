const User = require('../models/User');
const Tenant = require('../models/Tenant');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../middleware/auth');
const { recordLoginFailure, recordLoginSuccess } = require('../middleware/rateLimiter');
const SystemConfig = require('../models/SystemConfig');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_luminous_key_12345_67890', {
    expiresIn: '30d',
  });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!email || !password) {
      await recordLoginFailure(email || '', clientIp);
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for user (and select password field explicitly)
    const user = await User.findOne({ email: normalizedEmail, deletedAt: null }).select('+password');

    if (!user) {
      await recordLoginFailure(normalizedEmail, clientIp);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.active) {
      await recordLoginFailure(normalizedEmail, clientIp);
      return res.status(401).json({ success: false, message: 'Account has been deactivated. Contact Admin.' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      await recordLoginFailure(normalizedEmail, clientIp);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Log Activity
    await logActivity(user._id, 'LOGIN', 'User logged in successfully', req);

    await recordLoginSuccess(normalizedEmail, clientIp);

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register a new staff member
// @route   POST /api/auth/staff
// @access  Private/Admin
exports.registerStaff = async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;

    // Check if email exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Enforce subscription plan staff limits
    const tenant = await Tenant.findById(req.user.tenant);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const systemConfig = await SystemConfig.findOne() || await SystemConfig.create({});
    const limits = systemConfig.planLimits[tenant.plan] || { staffLimit: 3 };
    const limit = limits.staffLimit;

    if (role !== 'Admin') {
      const staffCount = await User.countDocuments({
        tenant: req.user.tenant,
        role: { $ne: 'Admin' },
        deletedAt: null
      });

      if (staffCount >= limit) {
        return res.status(400).json({
          success: false,
          message: `You have reached the maximum limit of ${limit} staff accounts for your ${tenant.plan} subscription plan. Please upgrade your plan.`
        });
      }
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      permissions,
      tenant: req.user.tenant,
    });

    // Log activity
    await logActivity(req.user._id, 'CREATE_STAFF', `Created staff account for ${email} with role ${role}`, req);

    res.status(201).json({
      success: true,
      message: 'Staff member registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all staff members
// @route   GET /api/auth/staff
// @access  Private/Admin
exports.getStaff = async (req, res) => {
  try {
    const query = { deletedAt: null };
    if (req.user.role !== 'SuperAdmin') {
      query.tenant = req.user.tenant;
    }
    const staff = await User.find(query).select('-password');
    res.status(200).json({
      success: true,
      staff,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update staff status or details
// @route   PUT /api/auth/staff/:id
// @access  Private/Admin
exports.updateStaff = async (req, res) => {
  try {
    const { name, email, role, active, password, permissions } = req.body;
    const query = { _id: req.params.id, deletedAt: null };
    if (req.user.role !== 'SuperAdmin') {
      query.tenant = req.user.tenant;
    }
    let user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // Enforce limits if role is updated from Admin to non-Admin
    if (role && role !== 'Admin' && user.role === 'Admin') {
      const tenant = await Tenant.findById(req.user.tenant);
      if (tenant) {
        const systemConfig = await SystemConfig.findOne() || await SystemConfig.create({});
        const limits = systemConfig.planLimits[tenant.plan] || { staffLimit: 3 };
        const limit = limits.staffLimit;

        const staffCount = await User.countDocuments({
          tenant: req.user.tenant,
          role: { $ne: 'Admin' },
          deletedAt: null
        });

        if (staffCount >= limit) {
          return res.status(400).json({
            success: false,
            message: `You have reached the maximum limit of ${limit} staff accounts for your ${tenant.plan} subscription plan. Please upgrade your plan.`
          });
        }
      }
    }

    // Prevent deactivating own account
    if (req.user._id.toString() === req.params.id && active === false) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    if (active !== undefined) {
      user.active = active;
    }
    if (password) {
      user.password = password;
    }
    if (permissions !== undefined) {
      user.permissions = permissions;
    }

    await user.save();

    await logActivity(
      req.user._id,
      'UPDATE_STAFF',
      `Updated details for staff ${user.email} (Active: ${user.active}, Role: ${user.role})`,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Staff updated successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a staff member
// @route   DELETE /api/auth/staff/:id
// @access  Private/Admin
exports.deleteStaff = async (req, res) => {
  try {
    const query = { _id: req.params.id, deletedAt: null };
    if (req.user.role !== 'SuperAdmin') {
      query.tenant = req.user.tenant;
    }
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    user.deletedAt = new Date();
    await user.save();

    await logActivity(req.user._id, 'DELETE_STAFF', `Deleted staff account ${user.email}`, req);

    res.status(200).json({
      success: true,
      message: 'Staff member deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
