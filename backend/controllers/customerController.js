const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const { logActivity } = require('../middleware/auth');

// @desc    Get all customers with pagination & search
// @route   GET /api/customers
// @access  Private
exports.getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    const query = { tenant: req.user.tenant, deletedAt: null };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const customers = await Customer.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalCustomers = await Customer.countDocuments(query);

    // Calculate invoice statistics for each customer inline (number of invoices, total spent)
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const invoices = await Invoice.find({
          customer: customer._id,
          tenant: req.user.tenant,
          deletedAt: null,
        });
        const purchaseCount = invoices.length;
        const totalSpent = invoices.reduce((sum, inv) => sum + (inv.paymentStatus === 'Paid' ? inv.grandTotal : 0), 0);

        return {
          ...customer.toObject(),
          purchaseCount,
          totalSpent,
        };
      })
    );

    res.status(200).json({
      success: true,
      pagination: {
        total: totalCustomers,
        pages: Math.ceil(totalCustomers / parseInt(limit, 10)),
        currentPage: parseInt(page, 10),
      },
      customers: customersWithStats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single customer profile details & purchase history
// @route   GET /api/customers/:id
// @access  Private
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Get purchase history invoices
    const invoices = await Invoice.find({
      customer: customer._id,
      tenant: req.user.tenant,
      deletedAt: null,
    })
      .populate('cashier', 'name')
      .sort('-createdAt');

    const totalSpent = invoices.reduce((sum, inv) => sum + (inv.paymentStatus === 'Paid' ? inv.grandTotal : 0), 0);

    res.status(200).json({
      success: true,
      customer,
      purchaseHistory: invoices,
      totalSpent,
      purchaseCount: invoices.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    // Prevent duplicates by checking if phone number already exists for this tenant
    if (phone && phone.trim() !== '') {
      const existing = await Customer.findOne({
        phone: phone.trim(),
        tenant: req.user.tenant,
        deletedAt: null,
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `A customer with phone number ${phone.trim()} already exists.` });
      }
    }

    const customer = await Customer.create({
      name,
      email: email || '',
      phone: phone || '',
      loyaltyPoints: 0,
      tenant: req.user.tenant,
    });

    await logActivity(req.user._id, 'CREATE_CUSTOMER', `Created customer "${name}"`, req);

    res.status(201).json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update customer details
// @route   PUT /api/customers/:id
// @access  Private
exports.updateCustomer = async (req, res) => {
  try {
    let customer = await Customer.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const { name, email, phone, loyaltyPoints } = req.body;

    customer.name = name || customer.name;
    customer.email = email !== undefined ? email : customer.email;
    customer.phone = phone !== undefined ? phone : customer.phone;
    if (loyaltyPoints !== undefined) {
      customer.loyaltyPoints = loyaltyPoints;
    }

    await customer.save();

    await logActivity(req.user._id, 'UPDATE_CUSTOMER', `Updated customer details for "${customer.name}"`, req);

    res.status(200).json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a customer (soft delete)
// @route   DELETE /api/customers/:id
// @access  Private/Admin or Manager
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.deletedAt = new Date();
    await customer.save();

    await logActivity(req.user._id, 'DELETE_CUSTOMER', `Deleted customer profile "${customer.name}"`, req);

    res.status(200).json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
