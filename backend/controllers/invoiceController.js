const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');
const Notification = require('../models/Notification');
const PDFDocument = require('pdfkit');
const { logActivity } = require('../middleware/auth');

// Helper to calculate total barcode width based on EAN-13 pseudo-lines
const calculatePDFBarcodeWidth = (value, scale = 0.8) => {
  const safeValue = value || '';
  let total = 0;
  for (let i = 0; i < 46; i++) {
    const charCode = safeValue.charCodeAt(i % (safeValue.length || 1)) || 0;
    total += (1 + (charCode % 3)) * scale;
  }
  return total;
};

// Helper to draw barcode lines in PDFKit
const drawPDFBarcode = (doc, value, x, y, height = 20, scale = 0.8) => {
  const safeValue = value || '';
  let currentX = x;
  
  for (let i = 0; i < 46; i++) {
    const isBlack = i % 2 === 0;
    const charCode = safeValue.charCodeAt(i % (safeValue.length || 1)) || 0;
    const width = (1 + (charCode % 3)) * scale;
    
    if (isBlack) {
      doc.rect(currentX, y, width, height).fill('#000000');
    }
    currentX += width;
  }
  return currentX - x;
};

// Helper to check and create low stock notification
const checkLowStockAlert = async (product) => {
  if (product.stock <= product.minStockLevel) {
    const alertMessage = `Product "${product.name}" (SKU: ${product.sku}) is running low on stock. Current level: ${product.stock} units.`;
    
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

// @desc    Create a new invoice (POS checkout)
// @route   POST /api/invoices
// @access  Private
exports.createInvoice = async (req, res) => {
  try {
    const { customerId, items, discount = 0, paymentMethod = 'Cash', paymentSplit } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required for checkout' });
    }

    const Coupon = require('../models/Coupon');
    let subtotal = 0;
    const invoiceItems = [];

    // 1. Validate items and stock levels
    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, tenant: req.user.tenant, deletedAt: null });
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.name || item.productId}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`,
        });
      }

      let discountPerItem = 0;
      let appliedCouponCode = '';

      if (item.couponCode) {
        const coupon = await Coupon.findOne({ code: item.couponCode.toUpperCase(), tenant: req.user.tenant, isActive: true, deletedAt: null });
        if (coupon && (!coupon.applicableProduct || coupon.applicableProduct.toString() === product._id.toString())) {
          // Check expiry
          if (!coupon.expiryDate || new Date(coupon.expiryDate) >= new Date()) {
            appliedCouponCode = coupon.code;
            if (coupon.discountType === 'Percentage') {
              discountPerItem = product.price * (coupon.discountValue / 100);
            } else if (coupon.discountType === 'Fixed') {
              discountPerItem = coupon.discountValue;
            }
          }
        }
      }

      const discountedPrice = Math.max(0, product.price - discountPerItem);
      const itemTotal = discountedPrice * item.quantity;
      const itemTaxRate = product.taxRate !== undefined ? product.taxRate : 18;
      const itemTax = itemTotal * (itemTaxRate / 100);
      const couponDiscountTotal = discountPerItem * item.quantity;

      invoiceItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        price: discountedPrice,
        costPrice: product.costPrice,
        mrp: product.mrp || 0,
        tax: parseFloat(itemTax.toFixed(2)),
        couponCode: appliedCouponCode,
        couponDiscount: parseFloat(couponDiscountTotal.toFixed(2)),
        total: parseFloat((itemTotal + itemTax).toFixed(2)),
      });

      subtotal += itemTotal;
    }

    const taxTotal = parseFloat(invoiceItems.reduce((sum, item) => sum + item.tax, 0).toFixed(2));
    const grandTotal = parseFloat((subtotal + taxTotal - discount).toFixed(2));

    // 2. Perform Stock deductions, Inventory Logs and Alerts
    for (const item of invoiceItems) {
      const product = await Product.findOne({ _id: item.product, tenant: req.user.tenant, deletedAt: null });
      if (product) {
        const stockBefore = product.stock;
        product.stock -= item.quantity;
        await product.save();

        // Log Inventory change
        await InventoryLog.create({
          product: product._id,
          changeType: 'Sale',
          quantityChanged: -item.quantity,
          stockBefore,
          stockAfter: product.stock,
          referenceId: `Checkout Invoice`,
          performedBy: req.user._id,
          tenant: req.user.tenant,
        });

        // Low Stock warning trigger
        await checkLowStockAlert(product);
      }
    }

    // 3. Generate invoice number (unique per tenant check can be added or standard suffix is enough)
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');
    const invoiceNumber = `INV-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Save Invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      customer: customerId || null,
      cashier: req.user._id,
      items: invoiceItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxTotal,
      discount: parseFloat(discount.toFixed(2)),
      grandTotal,
      paymentMethod,
      paymentSplit: paymentMethod === 'Mixed' && paymentSplit ? {
        Cash: paymentSplit.Cash || 0,
        Card: paymentSplit.Card || 0,
        UPI: paymentSplit.UPI || 0,
      } : { Cash: 0, Card: 0, UPI: 0 },
      paymentStatus: 'Paid',
      tenant: req.user.tenant,
    });

    // 5. Create Transaction entry
    if (paymentMethod === 'Mixed' && paymentSplit) {
      const methods = ['Cash', 'Card', 'UPI'];
      for (const method of methods) {
        const amt = paymentSplit[method] || 0;
        if (amt > 0) {
          const transactionNumber = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
          await Transaction.create({
            transactionNumber,
            invoice: invoice._id,
            type: 'Sale',
            category: 'Income',
            amount: parseFloat(amt.toFixed(2)),
            paymentMethod: method,
            referenceId: invoiceNumber,
            description: `POS Checkout (Mixed - ${method}) - Cashier: ${req.user.name}`,
            cashier: req.user._id,
            tenant: req.user.tenant,
          });
        }
      }
    } else {
      const transactionNumber = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
      await Transaction.create({
        transactionNumber,
        invoice: invoice._id,
        type: 'Sale',
        category: 'Income',
        amount: grandTotal,
        paymentMethod,
        referenceId: invoiceNumber,
        description: `POS Checkout - Cashier: ${req.user.name}`,
        cashier: req.user._id,
        tenant: req.user.tenant,
      });
    }

    // 6. Reward Loyalty Points (1 point for every $10 of subtotal spent)
    if (customerId) {
      const pointsEarned = Math.floor(subtotal / 10);
      if (pointsEarned > 0) {
        await Customer.findOneAndUpdate(
          { _id: customerId, tenant: req.user.tenant, deletedAt: null },
          { $inc: { loyaltyPoints: pointsEarned } }
        );
      }
    }

    // 7. Audit Log
    await logActivity(req.user._id, 'GENERATE_INVOICE', `Generated Invoice ${invoiceNumber} for $${grandTotal}`, req);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all invoices with filters
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '', startDate = '', endDate = '' } = req.query;

    const query = { tenant: req.user.tenant, deletedAt: null };

    // Search by invoice number
    if (search) {
      query.invoiceNumber = { $regex: search, $options: 'i' };
    }

    // Status filter
    if (status) {
      query.paymentStatus = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const invoices = await Invoice.find(query)
      .populate('customer', 'name phone email')
      .populate('cashier', 'name role')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalInvoices = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      pagination: {
        total: totalInvoices,
        pages: Math.ceil(totalInvoices / parseInt(limit, 10)),
        currentPage: parseInt(page, 10),
      },
      invoices,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single invoice detail
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, tenant: req.user.tenant, deletedAt: null })
      .populate('customer', 'name phone email loyaltyPoints')
      .populate('cashier', 'name role');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.status(200).json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refund an invoice and restore stock
// @route   POST /api/invoices/:id/refund
// @access  Private/Admin or Manager
exports.refundInvoice = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Refund reason is required' });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, tenant: req.user.tenant, deletedAt: null });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.paymentStatus === 'Refunded') {
      return res.status(400).json({ success: false, message: 'This invoice has already been refunded' });
    }

    // 1. Restore stock levels
    for (const item of invoice.items) {
      const product = await Product.findOne({ _id: item.product, tenant: req.user.tenant, deletedAt: null });
      if (product) {
        const stockBefore = product.stock;
        product.stock += item.quantity;
        await product.save();

        // Log inventory log change
        await InventoryLog.create({
          product: product._id,
          changeType: 'Refund',
          quantityChanged: item.quantity,
          stockBefore,
          stockAfter: product.stock,
          referenceId: `Refund of ${invoice.invoiceNumber}`,
          performedBy: req.user._id,
          tenant: req.user.tenant,
        });
      }
    }

    // 2. Mark invoice refunded
    invoice.paymentStatus = 'Refunded';
    invoice.refundReason = reason;
    invoice.refundedAmount = invoice.grandTotal;
    await invoice.save();

    // 3. Create reverse Transaction log (Expense)
    if (invoice.paymentMethod === 'Mixed' && invoice.paymentSplit) {
      const methods = ['Cash', 'Card', 'UPI'];
      for (const method of methods) {
        const amt = invoice.paymentSplit[method] || 0;
        if (amt > 0) {
          const transactionNumber = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
          await Transaction.create({
            transactionNumber,
            invoice: invoice._id,
            type: 'Refund',
            category: 'Expense',
            amount: amt,
            paymentMethod: method,
            referenceId: invoice.invoiceNumber,
            description: `Refund Invoice ${invoice.invoiceNumber} (Mixed - ${method}). Reason: ${reason}`,
            cashier: req.user._id,
            tenant: req.user.tenant,
          });
        }
      }
    } else {
      const transactionNumber = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
      await Transaction.create({
        transactionNumber,
        invoice: invoice._id,
        type: 'Refund',
        category: 'Expense',
        amount: invoice.grandTotal,
        paymentMethod: invoice.paymentMethod,
        referenceId: invoice.invoiceNumber,
        description: `Refund Invoice ${invoice.invoiceNumber}. Reason: ${reason}`,
        cashier: req.user._id,
        tenant: req.user.tenant,
      });
    }

    // 4. Deduct customer points if applicable
    if (invoice.customer) {
      const pointsDeducted = Math.floor(invoice.subtotal / 10);
      const customer = await Customer.findOne({ _id: invoice.customer, tenant: req.user.tenant, deletedAt: null });
      if (customer && pointsDeducted > 0) {
        customer.loyaltyPoints = Math.max(0, customer.loyaltyPoints - pointsDeducted);
        await customer.save();
      }
    }

    // 5. Activity Log
    await logActivity(req.user._id, 'REFUND_INVOICE', `Refunded Invoice ${invoice.invoiceNumber} ($${invoice.grandTotal})`, req);

    res.status(200).json({
      success: true,
      message: 'Invoice refunded and stock restored successfully',
      invoice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate and stream invoice PDF
// @route   GET /api/invoices/:id/pdf
// @access  Private
exports.generateInvoicePDF = async (req, res) => {
  try {
    const tokenOrId = req.params.shareToken || req.params.id;
    const isObjectId = tokenOrId.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: tokenOrId } : { shareToken: tokenOrId };

    const invoice = await Invoice.findOne(query)
      .populate('customer', 'name phone email')
      .populate('cashier', 'name')
      .populate('items.product', 'mrp');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // 1. Fetch shop profile dynamically using invoice's tenant
    const ShopProfile = require('../models/ShopProfile');
    let shop = await ShopProfile.findOne({ tenant: invoice.tenant });
    if (!shop) {
      shop = {
        name: 'Retail Store',
        logo: '',
        gstin: '',
        address: '',
        email: '',
        phone: '',
      };
    }

    let hasLogo = false;
    let logoImageSource = null;

    if (shop.logo && shop.logo.startsWith('data:image/')) {
      try {
        const base64Data = shop.logo.split(';base64,').pop();
        logoImageSource = Buffer.from(base64Data, 'base64');
        hasLogo = true;
      } catch (err) {
        console.error('Failed to parse base64 shop logo:', err);
      }
    }

    if (!hasLogo) {
      const fs = require('fs');
      const path = require('path');
      const logoPath = path.join(__dirname, '../../frontend/src/assets/luminous_logo.png');
      if (fs.existsSync(logoPath)) {
        logoImageSource = logoPath;
        hasLogo = true;
      }
    }

    // 2. Calculate dynamic height for 80mm printer paper width (226 points)
    const hasLogoImage = hasLogo && logoImageSource;
    const itemHeight = 17; // height per item in list
    // base height with barcode (adds ~40 points to layout height)
    let extraHeight = 0;
    if (invoice.exchangedFromInvoice) extraHeight += 12;
    if (invoice.exchangeCredit > 0) extraHeight += 9;
    const calculatedHeight = (hasLogoImage ? 475 : 430) + (invoice.items.length * itemHeight) + extraHeight;

    // 3. Initialize PDF document with thermal receipt format (226pt width = approx 80mm)
    const doc = new PDFDocument({ size: [226, calculatedHeight], margin: 12 });

    // Stream PDF directly to client response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);

    doc.pipe(res);

    let y = 15;

    // Draw centered logo
    if (hasLogoImage) {
      try {
        doc.image(logoImageSource, (226 - 45) / 2, y, { width: 45 });
        y += 50;
      } catch (imageErr) {
        console.error('PDFKit failed to draw logo:', imageErr);
      }
    }

    // Centered shop name
    doc
      .fillColor('#131b2e')
      .fontSize(9.5)
      .font('Helvetica-Bold')
      .text(shop.name.toUpperCase(), 12, y, { align: 'center', width: 202 });
    y = doc.y + 3;

    // Centered contact and GSTIN details without hardcoded overlap offsets
    doc
      .fillColor('#434656')
      .fontSize(6.5)
      .font('Helvetica')
      .text(shop.address, 12, y, { align: 'center', width: 202 });
    
    y = doc.y + 2;
    doc.text(`Phone: ${shop.phone}`, 12, y, { align: 'center', width: 202 });
    
    y = doc.y + 2;
    doc.text(`Email: ${shop.email}`, 12, y, { align: 'center', width: 202 });
    
    y = doc.y + 2;
    doc.font('Helvetica-Bold').text(`GSTIN: ${shop.gstin}`, 12, y, { align: 'center', width: 202 });
    
    y = doc.y + 6;

    // Divider
    doc.moveTo(12, y).lineTo(214, y).strokeColor('#c3c5d9').lineWidth(0.5).stroke();
    y += 6;

    // Meta details (Invoice, Date, Cashier, Payment)
    doc
      .fillColor('#131b2e')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(`Inv No:`, 12, y)
      .font('Helvetica')
      .text(invoice.invoiceNumber, 52, y)
      
      .font('Helvetica-Bold')
      .text(`Date:`, 118, y)
      .font('Helvetica')
      .text(`${new Date(invoice.createdAt).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })} ${new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`, 138, y, { width: 76, align: 'right' });
    y += 9;

    doc
      .fillColor('#131b2e')
      .font('Helvetica-Bold')
      .text(`Cashier:`, 12, y)
      .font('Helvetica')
      .text(invoice.cashier ? invoice.cashier.name : 'System', 52, y)
      
      .font('Helvetica-Bold')
      .text(`Pay via:`, 118, y)
      .font('Helvetica');

    let paymentMethodDisplay = invoice.paymentMethod;
    if (invoice.paymentMethod === 'Mixed' && invoice.paymentSplit) {
      const parts = [];
      if (invoice.paymentSplit.UPI) parts.push(`UPI:${invoice.paymentSplit.UPI}`);
      if (invoice.paymentSplit.Cash) parts.push(`Cash:${invoice.paymentSplit.Cash}`);
      if (invoice.paymentSplit.Card) parts.push(`Card:${invoice.paymentSplit.Card}`);
      if (parts.length > 0) {
        paymentMethodDisplay = `Mixed(${parts.join(',')})`;
      }
    }

    doc.text(paymentMethodDisplay, 148, y);
    y += 10;

    const customerName = invoice.customer ? invoice.customer.name : 'Walk-in Guest';
    const customerPhone = invoice.customer && invoice.customer.phone ? invoice.customer.phone : 'N/A';
    doc
      .font('Helvetica-Bold')
      .text(`Billed To:`, 12, y)
      .font('Helvetica')
      .text(`${customerName} (${customerPhone})`, 52, y, { width: 162, height: 10 });
    y += 12;

    if (invoice.exchangedFromInvoice) {
      doc
        .fillColor('#434656')
        .font('Helvetica-BoldOblique')
        .fontSize(6)
        .text(`Note: Exchanged with items from bill ${invoice.exchangedFromInvoice}`, 12, y);
      y += 8;
    }

    // Divider
    doc.moveTo(12, y).lineTo(214, y).strokeColor('#c3c5d9').lineWidth(0.5).stroke();
    y += 6;

    // Table Header
    doc
      .fillColor('#0041c8')
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text('Item Description', 12, y)
      .text('Qty', 98, y, { width: 18, align: 'right' })
      .text('MRP', 118, y, { width: 28, align: 'right' })
      .text('Price', 148, y, { width: 30, align: 'right' })
      .text('Total', 180, y, { width: 34, align: 'right' });
    y += 9;

    // Divider
    doc.moveTo(12, y).lineTo(214, y).strokeColor('#eaedff').lineWidth(0.5).stroke();
    y += 5;

    // Render Items
    doc.fillColor('#131b2e').fontSize(6.5);
    invoice.items.forEach((item) => {
      // Print item name
      doc.font('Helvetica-Bold').text(item.name, 12, y, { width: 84, height: 9, ellipsis: true });
      
      const itemMrpVal = item.mrp || (item.product && item.product.mrp) || 0;
      
      // Print qty, mrp, price, total
      doc.font('Helvetica')
        .text(item.quantity.toString(), 98, y, { width: 18, align: 'right' })
        .text(itemMrpVal > 0 ? `Rs.${itemMrpVal.toFixed(0)}` : '-', 118, y, { width: 28, align: 'right' })
        .text(`Rs.${item.price.toFixed(0)}`, 148, y, { width: 30, align: 'right' })
        .text(`Rs.${item.total.toFixed(0)}`, 180, y, { width: 34, align: 'right' });
      y += 9;

      // Print SKU/GST details subtext
      doc.fontSize(5.5).fillColor('#737688')
        .text(`SKU: ${item.sku} | Tax: Rs.${item.tax.toFixed(1)}`, 12, y);
      y += 8;
      
      // restore font size
      doc.fontSize(6.5).fillColor('#131b2e');
    });

    y += 2;
    // Divider
    doc.moveTo(12, y).lineTo(214, y).strokeColor('#c3c5d9').lineWidth(0.5).stroke();
    y += 6;

    // Totals Section
    doc.font('Helvetica').fontSize(7);
    
    doc.text('Subtotal:', 90, y).text(`Rs.${invoice.subtotal.toFixed(2)}`, 140, y, { width: 74, align: 'right' });
    y += 9;
    
    doc.text('Tax Total:', 90, y).text(`Rs.${invoice.taxTotal.toFixed(2)}`, 140, y, { width: 74, align: 'right' });
    y += 9;
    
    doc.text('Discount:', 90, y).text(`-Rs.${invoice.discount.toFixed(2)}`, 140, y, { width: 74, align: 'right' });
    y += 9;

    if (invoice.exchangeCredit > 0) {
      doc.text('Exchange Credit:', 90, y).text(`-Rs.${invoice.exchangeCredit.toFixed(2)}`, 140, y, { width: 74, align: 'right' });
      y += 9;
    }

    doc.moveTo(90, y).lineTo(214, y).strokeColor('#e2e7ff').lineWidth(0.5).stroke();
    y += 3;

    doc.font('Helvetica-Bold').fillColor('#0041c8')
      .text('Grand Total:', 90, y)
      .text(`Rs.${invoice.grandTotal.toFixed(2)}`, 140, y, { width: 74, align: 'right' });
    y += 14;

    // Divider
    doc.moveTo(12, y).lineTo(214, y).strokeColor('#c3c5d9').lineWidth(0.5).stroke();
    y += 6;

    // Draw barcode for invoice number returns/returns tracking
    try {
      const barcodeScale = 1.5;
      const barcodeH = 20;
      const barcodeWidth = calculatePDFBarcodeWidth(invoice.invoiceNumber, barcodeScale);
      const startX = (226 - barcodeWidth) / 2;
      
      drawPDFBarcode(doc, invoice.invoiceNumber, startX, y, barcodeH, barcodeScale);
      y += barcodeH + 6;

      // Divider below barcode
      doc.moveTo(12, y).lineTo(214, y).strokeColor('#c3c5d9').lineWidth(0.5).stroke();
      y += 6;
    } catch (barcodeErr) {
      console.error('Failed to draw barcode on PDF invoice:', barcodeErr);
    }

    // Terms and Conditions Section
    doc
      .fillColor('#131b2e')
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text('TERMS & CONDITIONS', 12, y, { align: 'center', width: 202 });
    y += 9;

    doc
      .fillColor('#737688')
      .font('Helvetica')
      .fontSize(5.2);

    const terms = [
      '1. Goods once sold cannot be refunded or taken back.',
      '2. Exchange valid within 7 days with original invoice.',
      '3. Defective items are subject to manufacturer warranty.',
      '4. All disputes are subject to local jurisdiction only.',
    ];

    terms.forEach((term) => {
      doc.text(term, 12, y, { align: 'left', width: 202 });
      y += 7;
    });

    y += 3;
    // Thank you message
    doc
      .fillColor('#0041c8')
      .font('Helvetica-Oblique')
      .fontSize(7)
      .text('Thank you for shopping with us!', 12, y, { align: 'center', width: 202 });

    doc.end();
  } catch (error) {
    console.error('Error generating thermal invoice PDF:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Process a partial return or exchange of items
// @route   POST /api/invoices/:id/return
// @access  Private
exports.returnOrExchangeItems = async (req, res) => {
  try {
    const { items, exchangeItems = [], reason, paymentMethod = 'Cash', paymentSplit } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Returned items are required' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Return reason is required' });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, tenant: req.user.tenant, deletedAt: null });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.paymentStatus === 'Refunded') {
      return res.status(400).json({ success: false, message: 'This invoice has already been fully refunded' });
    }

    const refundRatio = (invoice.exchangeCredit > 0) ? (invoice.grandTotal / (invoice.grandTotal + invoice.exchangeCredit)) : 1;

    let totalRefundValue = 0;
    let baseRefundSubtotal = 0;
    const returnOperations = [];

    // 1. Validate Returned Items
    for (const returnReq of items) {
      // Find item on the invoice
      const invoiceItem = invoice.items.find(
        (it) => it._id.toString() === returnReq.itemId || it.product.toString() === returnReq.itemId
      );

      if (!invoiceItem) {
        return res.status(404).json({
          success: false,
          message: `Item not found on this invoice for ID: ${returnReq.itemId}`,
        });
      }

      const availableQty = invoiceItem.quantity - (invoiceItem.returnedQuantity || 0);
      if (returnReq.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid return quantity for item "${invoiceItem.name}"`,
        });
      }

      if (returnReq.quantity > availableQty) {
        return res.status(400).json({
          success: false,
          message: `Cannot return ${returnReq.quantity} units of "${invoiceItem.name}". Only ${availableQty} units available.`,
        });
      }

      // Calculate refunded value for this item line
      // unitTotal includes tax
      const unitTotal = invoiceItem.total / invoiceItem.quantity;
      const unitPrice = invoiceItem.price; // unit base price
      const lineRefundValue = (unitTotal * returnReq.quantity) * refundRatio;
      const lineBaseSubtotal = (unitPrice * returnReq.quantity) * refundRatio;

      totalRefundValue += lineRefundValue;
      baseRefundSubtotal += lineBaseSubtotal;

      returnOperations.push({
        invoiceItem,
        returnQty: returnReq.quantity,
        lineRefundValue,
        lineBaseSubtotal,
      });
    }

    // 2. Validate Exchange Items (if any)
    let totalExchangeValue = 0;
    let baseExchangeSubtotal = 0;
    const exchangeOperations = [];

    for (const exchangeReq of exchangeItems) {
      const product = await Product.findOne({ _id: exchangeReq.productId, tenant: req.user.tenant, deletedAt: null });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Exchange product not found or inactive: ${exchangeReq.productId}`,
        });
      }

      if (exchangeReq.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Exchange quantity must be greater than 0 for "${product.name}"`,
        });
      }

      if (product.stock < exchangeReq.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for exchange product "${product.name}". Available: ${product.stock}`,
        });
      }

      // Exchange prices: retail price includes tax
      const taxRate = product.taxRate !== undefined ? product.taxRate : 18;
      const unitExchangeTotal = product.price * (1 + taxRate / 100);
      const lineExchangeValue = unitExchangeTotal * exchangeReq.quantity;
      const lineBaseSubtotal = product.price * exchangeReq.quantity;

      totalExchangeValue += lineExchangeValue;
      baseExchangeSubtotal += lineBaseSubtotal;

      exchangeOperations.push({
        product,
        exchangeQty: exchangeReq.quantity,
        lineExchangeValue,
        lineBaseSubtotal,
        taxRate,
      });
    }

    // Net Difference: what we owe the customer (if > 0) or what the customer owes us (if < 0)
    // Round off refund and exchange values to integers if they have decimals
    const roundedRefundValue = Math.round(totalRefundValue);
    const roundedExchangeValue = Math.round(totalExchangeValue);
    const netDiff = roundedRefundValue - roundedExchangeValue;
    const netSubtotalDiff = baseRefundSubtotal - baseExchangeSubtotal;

    // 3. Process Returns (Update stock, inventory logs, returnedQuantity)
    for (const op of returnOperations) {
      const { invoiceItem, returnQty } = op;
      invoiceItem.returnedQuantity = (invoiceItem.returnedQuantity || 0) + returnQty;

      // Update product stock (tenant-isolated)
      const product = await Product.findOne({ _id: invoiceItem.product, tenant: req.user.tenant, deletedAt: null });
      if (product) {
        const stockBefore = product.stock;
        product.stock += returnQty;
        await product.save();

        // Log Inventory change
        await InventoryLog.create({
          product: product._id,
          changeType: 'Refund',
          quantityChanged: returnQty,
          stockBefore,
          stockAfter: product.stock,
          referenceId: `Return of Invoice ${invoice.invoiceNumber}`,
          performedBy: req.user._id,
          tenant: req.user.tenant,
        });
      }
    }

    // 4. Process Exchanges (Update stock, inventory logs)
    for (const op of exchangeOperations) {
      const { product, exchangeQty } = op;
      const stockBefore = product.stock;
      product.stock -= exchangeQty;
      await product.save();

      // Log Inventory change
      await InventoryLog.create({
        product: product._id,
        changeType: 'Sale',
        quantityChanged: -exchangeQty,
        stockBefore,
        stockAfter: product.stock,
        referenceId: `Exchange of Invoice ${invoice.invoiceNumber}`,
        performedBy: req.user._id,
        tenant: req.user.tenant,
      });

      // Low stock warnings
      await checkLowStockAlert(product);
    }

    // 5. Update Invoice Payment Status and Refund Amount
    invoice.refundedAmount = parseFloat((invoice.refundedAmount + roundedRefundValue).toFixed(2));

    // Check if everything is fully returned
    let allReturned = true;
    for (const it of invoice.items) {
      if ((it.returnedQuantity || 0) < it.quantity) {
        allReturned = false;
        break;
      }
    }

    if (allReturned) {
      invoice.paymentStatus = 'Refunded';
    } else {
      invoice.paymentStatus = 'Partially Refunded';
    }
    invoice.refundReason = invoice.refundReason ? `${invoice.refundReason}; Partial return: ${reason}` : `Partial return: ${reason}`;
    await invoice.save();

    // 6. Handle customer loyalty points
    if (invoice.customer && netSubtotalDiff !== 0) {
      const pointsChange = Math.floor(netSubtotalDiff / 10);
      if (pointsChange !== 0) {
        const customer = await Customer.findOne({ _id: invoice.customer, tenant: req.user.tenant, deletedAt: null });
        if (customer) {
          if (pointsChange > 0) {
            // Deduct points because they returned more than they took
            customer.loyaltyPoints = Math.max(0, customer.loyaltyPoints - pointsChange);
          } else {
            // Reward points because they exchanged for a more expensive item
            customer.loyaltyPoints += Math.abs(pointsChange);
          }
          await customer.save();
        }
      }
    }

    // 7. Log Transactions
    // 7a. Log the Refund for returned items on the original Invoice A
    if (roundedRefundValue > 0) {
      if (invoice.paymentMethod === 'Mixed' && invoice.paymentSplit) {
        const totalPaid = invoice.grandTotal || 1;
        const ratio = roundedRefundValue / totalPaid;
        const methods = ['Cash', 'Card', 'UPI'];
        for (const method of methods) {
          const originalAmt = invoice.paymentSplit[method] || 0;
          const refundAmt = parseFloat((originalAmt * ratio).toFixed(2));
          if (refundAmt > 0) {
            const trxNo = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
            await Transaction.create({
              transactionNumber: trxNo,
              invoice: invoice._id,
              type: 'Refund',
              category: 'Expense',
              amount: refundAmt,
              paymentMethod: method,
              referenceId: invoice.invoiceNumber,
              description: `Refund for items returned on invoice ${invoice.invoiceNumber}`,
              cashier: req.user._id,
              tenant: req.user.tenant,
            });
          }
        }
      } else {
        const transactionNumberRefund = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
        await Transaction.create({
          transactionNumber: transactionNumberRefund,
          invoice: invoice._id,
          type: 'Refund',
          category: 'Expense',
          amount: roundedRefundValue,
          paymentMethod: invoice.paymentMethod,
          referenceId: invoice.invoiceNumber,
          description: `Refund for items returned on invoice ${invoice.invoiceNumber}`,
          cashier: req.user._id,
          tenant: req.user.tenant,
        });
      }
    }

    // 7b. Generate and save the NEW Exchange Invoice if exchangeItems exist
    let exchangeInvoice = null;
    if (exchangeItems.length > 0) {
      const exchangeInvoiceItems = [];
      for (const op of exchangeOperations) {
        const { product, exchangeQty, lineBaseSubtotal, taxRate } = op;
        const lineTotal = product.price * (1 + taxRate / 100) * exchangeQty;
        const lineTax = lineTotal - lineBaseSubtotal;

        exchangeInvoiceItems.push({
          product: product._id,
          name: product.name,
          sku: product.sku,
          quantity: exchangeQty,
          returnedQuantity: 0,
          price: product.price,
          costPrice: product.costPrice,
          mrp: product.mrp || 0,
          tax: parseFloat(lineTax.toFixed(2)),
          couponCode: '',
          couponDiscount: 0,
          total: parseFloat(lineTotal.toFixed(2)),
        });
      }

      // Generate exchange invoice number
      const today = new Date();
      const dateStr = today.getFullYear().toString() +
        (today.getMonth() + 1).toString().padStart(2, '0') +
        today.getDate().toString().padStart(2, '0');
      const exchangeInvoiceNumber = `INV-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newInvoiceGrandTotal = Math.max(0, roundedExchangeValue - roundedRefundValue);

      // Create new sales invoice
      exchangeInvoice = await Invoice.create({
        invoiceNumber: exchangeInvoiceNumber,
        customer: invoice.customer || null,
        cashier: req.user._id,
        items: exchangeInvoiceItems,
        subtotal: parseFloat(baseExchangeSubtotal.toFixed(2)),
        taxTotal: parseFloat((roundedExchangeValue - baseExchangeSubtotal).toFixed(2)),
        discount: 0,
        exchangeCredit: roundedRefundValue,
        exchangedFromInvoice: invoice.invoiceNumber,
        grandTotal: newInvoiceGrandTotal,
        paymentMethod: newInvoiceGrandTotal > 0 ? paymentMethod : 'Exchange Credit',
        paymentSplit: newInvoiceGrandTotal > 0 && paymentMethod === 'Mixed' && paymentSplit ? {
          Cash: paymentSplit.Cash || 0,
          Card: paymentSplit.Card || 0,
          UPI: paymentSplit.UPI || 0,
        } : { Cash: 0, Card: 0, UPI: 0 },
        paymentStatus: 'Paid',
        tenant: req.user.tenant,
      });

      // Log Exchange Credit transaction
      const exchangeCreditAmt = Math.min(roundedExchangeValue, roundedRefundValue);
      if (exchangeCreditAmt > 0) {
        const transactionNumberEx = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
        await Transaction.create({
          transactionNumber: transactionNumberEx,
          invoice: exchangeInvoice._id,
          type: 'Sale',
          category: 'Income',
          amount: parseFloat(exchangeCreditAmt.toFixed(2)),
          paymentMethod: 'Exchange Credit',
          referenceId: exchangeInvoiceNumber,
          description: `Exchange credit settlement from returned items on invoice ${invoice.invoiceNumber}`,
          cashier: req.user._id,
          tenant: req.user.tenant,
        });
      }

      // Log cash difference collected if any
      if (newInvoiceGrandTotal > 0) {
        if (paymentMethod === 'Mixed' && paymentSplit) {
          const methods = ['Cash', 'Card', 'UPI'];
          for (const method of methods) {
            const splitAmt = paymentSplit[method] || 0;
            if (splitAmt > 0) {
              const trxNo = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
              await Transaction.create({
                transactionNumber: trxNo,
                invoice: exchangeInvoice._id,
                type: 'Sale',
                category: 'Income',
                amount: parseFloat(splitAmt.toFixed(2)),
                paymentMethod: method,
                referenceId: exchangeInvoiceNumber,
                description: `Exchange difference collected (Mixed - ${method}) from invoice ${invoice.invoiceNumber}`,
                cashier: req.user._id,
                tenant: req.user.tenant,
              });
            }
          }
        } else {
          const transactionNumberDiff = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
          await Transaction.create({
            transactionNumber: transactionNumberDiff,
            invoice: exchangeInvoice._id,
            type: 'Sale',
            category: 'Income',
            amount: newInvoiceGrandTotal,
            paymentMethod: paymentMethod,
            referenceId: exchangeInvoiceNumber,
            description: `Exchange difference collected from invoice ${invoice.invoiceNumber}`,
            cashier: req.user._id,
            tenant: req.user.tenant,
          });
        }
      }
    }

    // 8. Audit Log
    await logActivity(
      req.user._id,
      'RETURN_EXCHANGE',
      `Processed Return/Exchange on ${invoice.invoiceNumber}. Refund: ₹${roundedRefundValue}, Exchange: ₹${roundedExchangeValue}, Net: ₹${netDiff}`,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Return/Exchange processed successfully',
      invoice,
      exchangeInvoice,
      netDiff,
    });
  } catch (error) {
    console.error('Error processing return/exchange:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
