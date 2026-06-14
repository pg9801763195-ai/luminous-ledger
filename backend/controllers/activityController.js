const ActivityLog = require('../models/ActivityLog');

// @desc    Get all activity logs with pagination and search
// @route   GET /api/activities
// @access  Private/Admin
exports.getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 25, search = '', action = '' } = req.query;

    const query = {};
    if (req.user.role !== 'SuperAdmin') {
      query.tenant = req.user.tenant;
    }

    if (search) {
      query.$or = [
        { details: { $regex: search, $options: 'i' } },
        { ipAddress: { $regex: search, $options: 'i' } },
      ];
    }

    if (action) {
      query.action = action;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const logs = await ActivityLog.find(query)
      .populate('user', 'name email role')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalLogs = await ActivityLog.countDocuments(query);

    res.status(200).json({
      success: true,
      pagination: {
        total: totalLogs,
        pages: Math.ceil(totalLogs / parseInt(limit, 10)),
        currentPage: parseInt(page, 10),
      },
      logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
