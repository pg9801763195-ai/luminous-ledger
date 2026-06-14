const SystemConfig = require('../models/SystemConfig');
const Tenant = require('../models/Tenant');
const Customer = require('../models/Customer');
const { logActivity } = require('../middleware/auth');

// @desc    Simulate sending WhatsApp campaign and log activity
// @route   POST /api/marketing/broadcast
// @access  Private (Manager/Admin)
exports.sendBroadcast = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenant);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const systemConfig = await SystemConfig.findOne() || await SystemConfig.create({});
    const limits = systemConfig.planLimits[tenant.plan] || { waMarketingEnabled: false };

    if (!limits.waMarketingEnabled) {
      return res.status(403).json({
        success: false,
        message: 'WA Marketing is only available on Premium and Enterprise plans. Please upgrade your plan.'
      });
    }

    const { customers, message, campaignName } = req.body;

    if (!customers || customers.length === 0) {
      return res.status(400).json({ success: false, message: 'No customers selected for broadcast' });
    }

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    // Process/verify customers (tenant-isolated)
    const targetCustomers = await Customer.find({
      _id: { $in: customers },
      tenant: req.user.tenant,
      deletedAt: null,
    });

    // Log the campaign broadcast event in Activity Logs
    const logDetails = `Sent WhatsApp Campaign "${campaignName || 'General Offer'}" to ${targetCustomers.length} customers. Message: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`;
    await logActivity(req.user._id, 'WHATSAPP_CAMPAIGN', logDetails, req);

    res.status(200).json({
      success: true,
      message: `WhatsApp campaign broadcast simulated successfully for ${targetCustomers.length} customers.`,
      recipientCount: targetCustomers.length,
    });
  } catch (error) {
    console.error('Error in marketing broadcast:', error);
    res.status(500).json({ success: false, message: 'Server error processing broadcast campaign' });
  }
};
