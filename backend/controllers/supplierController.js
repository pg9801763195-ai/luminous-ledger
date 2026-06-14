const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const { logActivity } = require('../middleware/auth');

// @desc    Get all suppliers with search
// @route   GET /api/suppliers
// @access  Private
exports.getSuppliers = async (req, res) => {
  try {
    const { search = '' } = req.query;

    const query = { tenant: req.user.tenant, deletedAt: null };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
      ];
    }

    const suppliers = await Supplier.find(query).sort('name');

    // Attach count of items supplied by each supplier (tenant-isolated)
    const suppliersWithCount = await Promise.all(
      suppliers.map(async (supplier) => {
        const productCount = await Product.countDocuments({
          supplier: supplier._id,
          tenant: req.user.tenant,
          active: true,
          deletedAt: null,
        });
        return {
          ...supplier.toObject(),
          productCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      suppliers: suppliersWithCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new supplier
// @route   POST /api/suppliers
// @access  Private/Admin or Manager
exports.createSupplier = async (req, res) => {
  try {
    const { name, contactPerson, email, phone, address } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const existingSupplier = await Supplier.findOne({
      name,
      tenant: req.user.tenant,
      deletedAt: null,
    });
    if (existingSupplier) {
      return res.status(400).json({ success: false, message: 'A supplier with this name already exists' });
    }

    const supplier = await Supplier.create({
      name,
      contactPerson: contactPerson || '',
      email: email || '',
      phone: phone || '',
      address: address || '',
      tenant: req.user.tenant,
    });

    await logActivity(req.user._id, 'CREATE_SUPPLIER', `Created supplier "${name}"`, req);

    res.status(201).json({ success: true, supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a supplier
// @route   PUT /api/suppliers/:id
// @access  Private/Admin or Manager
exports.updateSupplier = async (req, res) => {
  try {
    let supplier = await Supplier.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const { name, contactPerson, email, phone, address } = req.body;

    if (name && name !== supplier.name) {
      const existingSupplier = await Supplier.findOne({
        name,
        tenant: req.user.tenant,
        deletedAt: null,
      });
      if (existingSupplier) {
        return res.status(400).json({ success: false, message: 'A supplier with this name already exists' });
      }
      supplier.name = name;
    }

    supplier.contactPerson = contactPerson !== undefined ? contactPerson : supplier.contactPerson;
    supplier.email = email !== undefined ? email : supplier.email;
    supplier.phone = phone !== undefined ? phone : supplier.phone;
    supplier.address = address !== undefined ? address : supplier.address;

    await supplier.save();

    await logActivity(req.user._id, 'UPDATE_SUPPLIER', `Updated supplier details for "${supplier.name}"`, req);

    res.status(200).json({ success: true, supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a supplier (soft delete)
// @route   DELETE /api/suppliers/:id
// @access  Private/Admin or Manager
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Unlink supplier from all products for this tenant
    await Product.updateMany(
      { supplier: supplier._id, tenant: req.user.tenant },
      { $set: { supplier: null } }
    );

    supplier.deletedAt = new Date();
    await supplier.save();

    await logActivity(req.user._id, 'DELETE_SUPPLIER', `Deleted supplier profile "${supplier.name}"`, req);

    res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
