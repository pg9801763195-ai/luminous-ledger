const Coupon = require('../models/Coupon');
const Product = require('../models/Product');
const { logActivity } = require('../middleware/auth');

// @desc    Create a new discount coupon
// @route   POST /api/coupons
// @access  Private (Manager/Admin)
exports.createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, applicableProduct, expiryDate } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Check if coupon code already exists for this tenant
    const couponExists = await Coupon.findOne({
      code: code.toUpperCase(),
      tenant: req.user.tenant,
      deletedAt: null,
    });
    if (couponExists) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    let product = null;
    if (applicableProduct) {
      // Verify product exists and belongs to this tenant
      product = await Product.findOne({
        _id: applicableProduct,
        tenant: req.user.tenant,
        deletedAt: null,
      });
      if (!product) {
        return res.status(404).json({ success: false, message: 'Applicable product not found in your inventory' });
      }
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      applicableProduct: applicableProduct || null,
      expiryDate: expiryDate || null,
      tenant: req.user.tenant,
    });

    const activityMsg = product
      ? `Created discount coupon code "${coupon.code}" for product "${product.name}"`
      : `Created universal discount coupon code "${coupon.code}"`;

    await logActivity(req.user._id, 'Create Coupon', activityMsg, req);

    res.status(201).json({
      success: true,
      message: 'Discount coupon created successfully',
      coupon,
    });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ success: false, message: 'Server error creating coupon' });
  }
};

// @desc    Get all discount coupons
// @route   GET /api/coupons
// @access  Private (Staff)
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({ tenant: req.user.tenant, deletedAt: null })
      .populate('applicableProduct', 'sku name price')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      coupons,
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ success: false, message: 'Server error fetching coupons' });
  }
};

// @desc    Delete a discount coupon (soft delete)
// @route   DELETE /api/coupons/:id
// @access  Private (Manager/Admin)
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    coupon.deletedAt = new Date();
    await coupon.save();

    await logActivity(req.user._id, 'Delete Coupon', `Deleted coupon code "${coupon.code}"`, req);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ success: false, message: 'Server error deleting coupon' });
  }
};

// @desc    Validate a coupon code
// @route   GET /api/coupons/validate/:code
// @access  Private (Staff)
exports.validateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { productId } = req.query;

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      tenant: req.user.tenant,
      isActive: true,
      deletedAt: null,
    });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive coupon code' });
    }

    // Check expiry date
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ success: false, message: 'Coupon code has expired' });
    }

    // Check product applicability if productId is specified and coupon is product-specific
    if (productId && coupon.applicableProduct && coupon.applicableProduct.toString() !== productId) {
      return res.status(400).json({ success: false, message: 'This coupon is not applicable to the selected product' });
    }

    res.status(200).json({
      success: true,
      message: 'Coupon code validated successfully',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      applicableProduct: coupon.applicableProduct,
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ success: false, message: 'Server error validating coupon' });
  }
};
