const ShopProfile = require('../models/ShopProfile');
const Tenant = require('../models/Tenant');
const { logActivity } = require('../middleware/auth');
const SystemConfig = require('../models/SystemConfig');

// @desc    Get public shop profile (name and logo only)
// @route   GET /api/shop/public
// @access  Public
exports.getPublicShopProfile = async (req, res) => {
  try {
    let query = {};
    const slug = req.query.slug || req.headers['x-tenant-slug'];

    if (slug) {
      const tenant = await Tenant.findOne({ slug: slug.toLowerCase() });
      if (tenant) {
        query = { tenant: tenant._id };
      } else {
        return res.status(404).json({ success: false, message: 'Tenant store not found' });
      }
    }

    let profile = await ShopProfile.findOne(query);
    if (!profile) {
      // Fallback: if no matching tenant profile found, look for any shop profile or default
      profile = await ShopProfile.findOne({}) || {
        name: 'Retail Store',
        logo: '',
      };
    }

    res.status(200).json({
      success: true,
      profile: {
        name: profile.name,
        logo: profile.logo,
      },
    });
  } catch (error) {
    console.error('Error fetching public shop profile:', error);
    res.status(500).json({ success: false, message: 'Server error fetching public shop profile' });
  }
};

// @desc    Get the shop profile (private)
// @route   GET /api/shop
// @access  Private (Staff)
exports.getShopProfile = async (req, res) => {
  try {
    if (!req.user.tenant) {
      return res.status(200).json({
        success: true,
        profile: {
          name: 'Luminous Platform',
          logo: '',
          gstin: '',
          address: '',
          email: 'superadmin@luminous.com',
          phone: '',
        }
      });
    }

    let profile = await ShopProfile.findOne({ tenant: req.user.tenant });
    if (!profile) {
      // Create default profile using tenant's name if it doesn't exist
      const tenant = await Tenant.findById(req.user.tenant);
      profile = await ShopProfile.create({
        name: tenant ? tenant.name : 'Retail Store',
        logo: '',
        gstin: '',
        address: '',
        email: tenant ? `${tenant.slug}@luminous.com` : '',
        phone: '',
        tenant: req.user.tenant,
      });
    }

    const tenantObj = await Tenant.findById(req.user.tenant);
    const plan = tenantObj ? tenantObj.plan : 'Basic';
    const slug = tenantObj ? tenantObj.slug : '';

    const systemConfig = await SystemConfig.findOne() || await SystemConfig.create({});
    const planLimits = systemConfig.planLimits[plan] || { staffLimit: 3, waMarketingEnabled: false };
    const announcement = systemConfig.announcement || '';

    res.status(200).json({
      success: true,
      profile: {
        ...profile.toObject(),
        plan,
        slug,
        staffLimit: planLimits.staffLimit,
        waMarketingEnabled: planLimits.waMarketingEnabled,
        announcement,
      },
    });
  } catch (error) {
    console.error('Error fetching shop profile:', error);
    res.status(500).json({ success: false, message: 'Server error fetching shop profile' });
  }
};

// @desc    Update the shop profile
// @route   PUT /api/shop
// @access  Private (Manager/Admin)
exports.updateShopProfile = async (req, res) => {
  try {
    if (!req.user.tenant) {
      return res.status(400).json({ success: false, message: 'Super-Admin cannot update platform profile directly' });
    }

    const { name, logo, address, email, phone, receiptBaseUrl } = req.body;

    let profile = await ShopProfile.findOne({ tenant: req.user.tenant });
    if (!profile) {
      const tenant = await Tenant.findById(req.user.tenant);
      profile = new ShopProfile({
        tenant: req.user.tenant,
        name: tenant ? tenant.name : name,
      });
    }

    profile.name = name || profile.name;
    profile.logo = logo !== undefined ? logo : profile.logo;
    // Note: profile.gstin is not updated here to restrict authorization to SuperAdmin only.
    profile.address = address !== undefined ? address : profile.address;
    profile.email = email !== undefined ? email : profile.email;
    profile.phone = phone !== undefined ? phone : profile.phone;
    profile.receiptBaseUrl = receiptBaseUrl !== undefined ? receiptBaseUrl : profile.receiptBaseUrl;
    profile.metaApiEnabled = req.body.metaApiEnabled !== undefined ? req.body.metaApiEnabled : profile.metaApiEnabled;

    await profile.save();

    await logActivity(req.user._id, 'Update Shop Profile', `Updated shop configuration for "${profile.name}"`, req);

    res.status(200).json({
      success: true,
      message: 'Shop profile updated successfully',
      profile,
    });
  } catch (error) {
    console.error('Error updating shop profile:', error);
    res.status(500).json({ success: false, message: 'Server error updating shop profile' });
  }
};
