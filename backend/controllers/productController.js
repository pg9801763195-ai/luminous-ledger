const Product = require('../models/Product');
const InventoryLog = require('../models/InventoryLog');
const Notification = require('../models/Notification');
const { logActivity } = require('../middleware/auth');

// Helper to check and create low stock notification
const checkLowStockAlert = async (product) => {
  if (product.stock <= product.minStockLevel) {
    const alertMessage = `Product "${product.name}" (SKU: ${product.sku}) is running low on stock. Current level: ${product.stock} units.`;

    // Check if there is already an unread notification for this product and tenant
    const existingNotification = await Notification.findOne({
      type: 'Low Stock',
      referenceId: product._id.toString(),
      read: false,
      tenant: product.tenant,
    });

    if (!existingNotification) {
      await Notification.create({
        type: 'Low Stock',
        message: alertMessage,
        referenceId: product._id.toString(),
        tenant: product.tenant,
      });
    }
  }
};

// @desc    Get all products with pagination, filtering, searching, and sorting
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '', sort = '-updatedAt' } = req.query;

    const query = { tenant: req.user.tenant, deletedAt: null };

    // Search query: match name or sku
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    };

    const skip = (options.page - 1) * options.limit;

    // Execute queries
    const products = await Product.find(query)
      .populate('supplier', 'name')
      .sort(sort)
      .skip(skip)
      .limit(options.limit);

    const totalProducts = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      pagination: {
        total: totalProducts,
        pages: Math.ceil(totalProducts / options.limit),
        currentPage: options.page,
        limit: options.limit,
      },
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    }).populate('supplier', 'name');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin or Manager
exports.createProduct = async (req, res) => {
  try {
    const { sku, name, description, category, price, costPrice, stock, minStockLevel, supplier, taxRate = 18, mrp = 0 } = req.body;

    // Generate unique barcode if SKU is blank
    let finalSku = sku ? sku.trim() : '';
    if (!finalSku) {
      let isUnique = false;
      while (!isUnique) {
        // EAN-13 style: 890 (India) followed by 10 random digits
        const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        finalSku = `890${randomDigits}`;
        const existing = await Product.findOne({
          sku: finalSku,
          tenant: req.user.tenant,
          deletedAt: null,
        });
        if (!existing) {
          isUnique = true;
        }
      }
    } else {
      // Check SKU unique if entered by user
      const existingSku = await Product.findOne({
        sku: finalSku,
        tenant: req.user.tenant,
        deletedAt: null,
      });
      if (existingSku) {
        return res.status(400).json({ success: false, message: `A product with SKU "${finalSku}" already exists.` });
      }
    }

    const product = await Product.create({
      sku: finalSku,
      name,
      description,
      category,
      price,
      costPrice,
      stock,
      minStockLevel,
      supplier: supplier || null,
      taxRate: parseFloat(taxRate) || 0,
      mrp: parseFloat(mrp) || 0,
      tenant: req.user.tenant,
    });

    // Log Inventory adjustment for initial stock
    if (stock > 0) {
      await InventoryLog.create({
        product: product._id,
        changeType: 'Stock-In',
        quantityChanged: stock,
        stockBefore: 0,
        stockAfter: stock,
        referenceId: 'Initial stock setup',
        performedBy: req.user._id,
        tenant: req.user.tenant,
      });
    }

    // Check low stock levels
    await checkLowStockAlert(product);

    // Log Activity
    await logActivity(req.user._id, 'CREATE_PRODUCT', `Created product "${name}" with SKU: ${finalSku}`, req);

    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin or Manager
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const { sku, name, description, category, price, costPrice, minStockLevel, supplier, taxRate, mrp } = req.body;

    // SKU conflict check
    if (sku && sku !== product.sku) {
      const existingSku = await Product.findOne({
        sku,
        tenant: req.user.tenant,
        deletedAt: null,
      });
      if (existingSku) {
        return res.status(400).json({ success: false, message: `SKU "${sku}" is already in use by another product.` });
      }
      product.sku = sku;
    }

    product.name = name || product.name;
    product.description = description !== undefined ? description : product.description;
    product.category = category || product.category;
    if (price !== undefined) product.price = price;
    if (costPrice !== undefined) product.costPrice = costPrice;
    if (minStockLevel !== undefined) product.minStockLevel = minStockLevel;
    if (supplier !== undefined) product.supplier = supplier || null;
    if (taxRate !== undefined) product.taxRate = parseFloat(taxRate) || 0;
    if (mrp !== undefined) product.mrp = parseFloat(mrp) || 0;

    await product.save();

    // Check low stock levels after changes
    await checkLowStockAlert(product);

    // Log Activity
    await logActivity(req.user._id, 'UPDATE_PRODUCT', `Updated details of product "${product.name}" (SKU: ${product.sku})`, req);

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Manually adjust stock (Stock-in / Stock-out)
// @route   PUT /api/products/:id/adjust-stock
// @access  Private/Admin or Manager
exports.adjustStock = async (req, res) => {
  try {
    const { quantity, changeType, description } = req.body;

    if (!quantity || isNaN(quantity)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid quantity number' });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const stockBefore = product.stock;
    let stockAfter = stockBefore;

    if (changeType === 'Stock-In' || changeType === 'Purchase') {
      stockAfter += Math.abs(quantity);
    } else if (changeType === 'Adjustment' || changeType === 'Sale') {
      // Adjustment can be negative, let's treat quantity as signed
      stockAfter += quantity;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid stock change type. Must be Stock-In, Purchase, or Adjustment.' });
    }

    if (stockAfter < 0) {
      return res.status(400).json({ success: false, message: `Operation rejected. Adjusted stock cannot drop below 0. Current: ${stockBefore}, Adjusted: ${stockAfter}` });
    }

    product.stock = stockAfter;
    await product.save();

    // Log to inventory log
    await InventoryLog.create({
      product: product._id,
      changeType,
      quantityChanged: stockAfter - stockBefore,
      stockBefore,
      stockAfter,
      referenceId: description || 'Manual adjustment',
      performedBy: req.user._id,
      tenant: req.user.tenant,
    });

    // Check low stock alerts
    await checkLowStockAlert(product);

    // Log Activity
    await logActivity(
      req.user._id,
      'ADJUST_STOCK',
      `Adjusted stock for "${product.name}" by ${stockAfter - stockBefore} units (New total: ${stockAfter})`,
      req
    );

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product (Logical delete)
// @route   DELETE /api/products/:id
// @access  Private/Admin or Manager
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      tenant: req.user.tenant,
      deletedAt: null,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.deletedAt = new Date();
    product.active = false;
    await product.save();

    // Log Activity
    await logActivity(req.user._id, 'DELETE_PRODUCT', `Soft deleted product "${product.name}" (SKU: ${product.sku})`, req);

    res.status(200).json({ success: true, message: 'Product removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get global stock adjustment log history (audit logs)
// @route   GET /api/products/logs/history
// @access  Private/Admin or Manager
exports.getInventoryLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, productId = '' } = req.query;

    const query = { tenant: req.user.tenant };
    if (productId) {
      query.product = productId;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const logs = await InventoryLog.find(query)
      .populate('product', 'name sku')
      .populate('performedBy', 'name role')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalLogs = await InventoryLog.countDocuments(query);

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
