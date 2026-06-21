const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const ShopProfile = require('../models/ShopProfile');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');
const SystemConfig = require('../models/SystemConfig');
const JWT_SECRET = require('../config/jwt');

// @desc    Get all tenants with stats & user list
// @route   GET /api/saas/tenants
// @access  Private/SuperAdmin
exports.getTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find({});

    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const [userCount, productCount, invoiceCount, users, profile] = await Promise.all([
          User.countDocuments({ tenant: tenant._id, deletedAt: null }),
          Product.countDocuments({ tenant: tenant._id, deletedAt: null }),
          Invoice.countDocuments({ tenant: tenant._id, deletedAt: null }),
          User.find({ tenant: tenant._id, deletedAt: null }).select('-password'),
          ShopProfile.findOne({ tenant: tenant._id })
        ]);

        const gstin = profile ? profile.gstin : '';

        return {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          plan: tenant.plan,
          gstin: gstin,
          createdAt: tenant.createdAt,
          stats: {
            users: userCount,
            products: productCount,
            invoices: invoiceCount,
          },
          users,
        };
      })
    );

    res.status(200).json({ success: true, data: tenantsWithStats });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
 
// @desc    Create a new tenant with initial Admin account
// @route   POST /api/saas/tenants
// @access  Private/SuperAdmin
exports.createTenant = async (req, res) => {
  let createdTenant = null;
  let createdUser = null;
  try {
    const { name, slug, plan, adminName, adminEmail, adminPassword, gstin } = req.body;
    const finalName = name && name.trim() ? name.trim() : 'Default Retail Store';

    if (!slug || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields (Slug, Admin Name, Email, Password)' });
    }

    // Check if tenant slug already exists
    const slugExists = await Tenant.findOne({ slug: slug.toLowerCase() });
    if (slugExists) {
      return res.status(400).json({ success: false, message: 'Tenant slug/subdomain is already taken' });
    }

    // Check if admin email already exists
    const userExists = await User.findOne({ email: adminEmail.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Admin email is already registered' });
    }

    // Create the Tenant
    createdTenant = await Tenant.create({
      name: finalName,
      slug: slug.toLowerCase(),
      plan: plan || 'Basic',
      status: 'Active',
    });

    // Create the Admin User
    createdUser = await User.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      role: 'Admin',
      tenant: createdTenant._id,
    });

    // Create default ShopProfile for the tenant
    await ShopProfile.create({
      name: finalName,
      logo: '',
      gstin: gstin ? gstin.trim() : '',
      address: '',
      email: adminEmail,
      phone: '',
      tenant: createdTenant._id,
    });

    // Log the tenant creation
    await logActivity(
      req.user._id,
      'CREATE_TENANT',
      `SuperAdmin created tenant ${name} (${slug}) and admin ${adminEmail}`,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Tenant and Admin user created successfully',
      data: {
        tenant: createdTenant,
        admin: {
          id: createdUser._id,
          name: createdUser.name,
          email: createdUser.email,
        },
      },
    });
  } catch (error) {
    console.error('Error creating tenant:', error);

    // Rollback any successfully created documents to prevent orphan/partial records
    try {
      if (createdUser) {
        await User.deleteOne({ _id: createdUser._id });
      }
      if (createdTenant) {
        await Tenant.deleteOne({ _id: createdTenant._id });
        await ShopProfile.deleteMany({ tenant: createdTenant._id });
      }
    } catch (rollbackError) {
      console.error('Failed to rollback tenant creation:', rollbackError);
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update tenant info or suspend/unsuspend
// @route   PUT /api/saas/tenants/:id
// @access  Private/SuperAdmin
exports.updateTenant = async (req, res) => {
  try {
    const { name, plan, status, gstin } = req.body;
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    if (name) {
      tenant.name = name;
      await ShopProfile.findOneAndUpdate(
        { tenant: tenant._id },
        { name: name },
        { new: true }
      );
    }
    if (plan) tenant.plan = plan;
    if (status) tenant.status = status;

    await tenant.save();

    if (gstin !== undefined) {
      await ShopProfile.findOneAndUpdate(
        { tenant: tenant._id },
        { gstin: gstin.trim() },
        { new: true, upsert: true }
      );
    }

    // Log the update
    await logActivity(
      req.user._id,
      'UPDATE_TENANT',
      `SuperAdmin updated tenant ${tenant.name}. Status: ${tenant.status}, Plan: ${tenant.plan}`,
      req
    );

    res.status(200).json({ success: true, message: 'Tenant updated successfully', data: tenant });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate a user impersonation JWT token
// @route   POST /api/saas/impersonate/:userId
// @access  Private/SuperAdmin
exports.impersonateUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }

    if (targetUser.role === 'SuperAdmin') {
      return res.status(400).json({ success: false, message: 'Cannot impersonate another SuperAdmin' });
    }

    // Generate impersonation token (1-hour expiration for security compliance)
    const token = jwt.sign(
      {
        id: targetUser._id,
        impersonatorId: req.user._id,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Fetch tenant details for context
    const tenant = await Tenant.findById(targetUser.tenant);

    // Log the impersonation action in audit trail
    await logActivity(
      req.user._id,
      'IMPERSONATION_START',
      `SuperAdmin started impersonating User: ${targetUser.email} (${targetUser.role}) of Tenant: ${tenant ? tenant.name : 'Unknown'}`,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Impersonation token generated successfully',
      token,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        permissions: targetUser.permissions,
        tenant: targetUser.tenant,
      },
    });
  } catch (error) {
    console.error('Error starting impersonation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get system-wide activity logs
// @route   GET /api/saas/logs
// @access  Private/SuperAdmin
exports.getSystemLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const action = req.query.action || '';
    const search = req.query.search || '';

    let query = {};
    if (action) {
      query.action = action;
    }
    if (search) {
      query.$or = [
        { details: { $regex: search, $options: 'i' } },
        { ipAddress: { $regex: search, $options: 'i' } }
      ];
    }

    const totalLogs = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .populate('user', 'name email role')
      .populate('tenant', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      logs,
      pagination: {
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit),
        page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get cumulative system analytics
// @route   GET /api/saas/analytics
// @access  Private/SuperAdmin
exports.getSystemAnalytics = async (req, res) => {
  try {
    const tenants = await Tenant.find({});
    
    // Plan distribution
    const planCounts = { Basic: 0, Premium: 0, Enterprise: 0 };
    tenants.forEach(t => {
      if (planCounts[t.plan] !== undefined) {
        planCounts[t.plan]++;
      }
    });

    // Cumulative stats
    const [totalStaff, totalProducts, totalInvoices] = await Promise.all([
      User.countDocuments({ role: { $ne: 'SuperAdmin' }, deletedAt: null }),
      Product.countDocuments({ deletedAt: null }),
      Invoice.countDocuments({ deletedAt: null })
    ]);

    // Calculate MRR
    const mrr = (planCounts.Premium * 99) + (planCounts.Enterprise * 499);

    // Dynamic store growth metric (by registration month)
    const storeGrowth = await Tenant.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        planCounts,
        totals: {
          stores: tenants.length,
          activeStores: tenants.filter(t => t.status === 'Active').length,
          suspendedStores: tenants.filter(t => t.status === 'Suspended').length,
          staff: totalStaff,
          products: totalProducts,
          invoices: totalInvoices
        },
        mrr,
        storeGrowth
      }
    });
  } catch (error) {
    console.error('Error compiling system analytics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dynamic plan limit configuration and announcement
// @route   GET /api/saas/config
// @access  Private/SuperAdmin
exports.getSystemConfig = async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({});
    }
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching system config:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update system configuration (limits or announcements)
// @route   PUT /api/saas/config
// @access  Private/SuperAdmin
exports.updateSystemConfig = async (req, res) => {
  try {
    const { announcement, planLimits } = req.body;
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig();
    }

    if (announcement !== undefined) {
      config.announcement = announcement;
    }
    if (planLimits !== undefined) {
      config.planLimits = planLimits;
    }

    await config.save();

    // Log config updates
    await logActivity(
      req.user._id,
      'UPDATE_SYSTEM_CONFIG',
      `SuperAdmin updated global configurations. Announcement: "${config.announcement}"`,
      req
    );

    res.status(200).json({ success: true, message: 'System configuration updated successfully', data: config });
  } catch (error) {
    console.error('Error updating system config:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a tenant completely (all data)
// @route   DELETE /api/saas/tenants/:id
// @access  Private/SuperAdmin
exports.deleteTenant = async (req, res) => {
  try {
    const tenantId = req.params.id;

    // Find the tenant to verify existence
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Require other models locally
    const Customer = require('../models/Customer');
    const Supplier = require('../models/Supplier');
    const Transaction = require('../models/Transaction');
    const InventoryLog = require('../models/InventoryLog');
    const Notification = require('../models/Notification');
    const Coupon = require('../models/Coupon');

    // 1. Delete all resources related to this tenant
    await Promise.all([
      User.deleteMany({ tenant: tenantId }),
      Product.deleteMany({ tenant: tenantId }),
      Customer.deleteMany({ tenant: tenantId }),
      Supplier.deleteMany({ tenant: tenantId }),
      Invoice.deleteMany({ tenant: tenantId }),
      Transaction.deleteMany({ tenant: tenantId }),
      InventoryLog.deleteMany({ tenant: tenantId }),
      Notification.deleteMany({ tenant: tenantId }),
      Coupon.deleteMany({ tenant: tenantId }),
      ShopProfile.deleteMany({ tenant: tenantId }),
      ActivityLog.deleteMany({ tenant: tenantId }),
      Tenant.deleteOne({ _id: tenantId }),
    ]);

    // 2. Log SuperAdmin delete tenant activity (system level)
    await logActivity(
      req.user._id,
      'DELETE_TENANT',
      `SuperAdmin deleted tenant ${tenant.name} (${tenant.slug}) and all associated records`,
      req
    );

    res.status(200).json({
      success: true,
      message: `Tenant "${tenant.name}" and all associated data have been permanently deleted`,
    });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all active rate limit records
// @route   GET /api/saas/rate-limits
// @access  Private/SuperAdmin
exports.getRateLimits = async (req, res) => {
  try {
    const RateLimit = require('../models/RateLimit');
    const limits = await RateLimit.find({}).sort({ updatedAt: -1 });
    res.status(200).json({ success: true, data: limits });
  } catch (error) {
    console.error('Error fetching rate limits:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset a specific rate limit (delete record)
// @route   DELETE /api/saas/rate-limits/:id
// @access  Private/SuperAdmin
exports.deleteRateLimit = async (req, res) => {
  try {
    const RateLimit = require('../models/RateLimit');
    const limit = await RateLimit.findById(req.params.id);
    if (!limit) {
      return res.status(404).json({ success: false, message: 'Rate limit record not found' });
    }

    await RateLimit.deleteOne({ _id: req.params.id });

    // Log the administrative action
    await logActivity(
      req.user._id,
      'RESET_RATE_LIMIT',
      `SuperAdmin reset rate limit block for key: "${limit.key}"`,
      req
    );

    res.status(200).json({ success: true, message: `Rate limit for "${limit.key}" has been reset successfully` });
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
