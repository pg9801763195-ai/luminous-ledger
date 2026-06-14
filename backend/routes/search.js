const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Tenant = require('../models/Tenant');

router.get('/', protect, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.status(200).json({
        success: true,
        results: { products: [], customers: [], pages: [], tenants: [] }
      });
    }

    const searchRegex = { $regex: q.trim(), $options: 'i' };
    let products = [];
    let customers = [];
    let tenants = [];

    if (req.user.role === 'SuperAdmin') {
      // SuperAdmin searches across store tenants
      tenants = await Tenant.find({
        $or: [
          { name: searchRegex },
          { slug: searchRegex }
        ]
      }).limit(5);
    } else if (req.user.tenant) {
      // Tenant-scoped searches
      products = await Product.find({
        tenant: req.user.tenant,
        deletedAt: null,
        $or: [
          { name: searchRegex },
          { sku: searchRegex }
        ]
      }).limit(5);

      customers = await Customer.find({
        tenant: req.user.tenant,
        deletedAt: null,
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { email: searchRegex }
        ]
      }).limit(5);
    }

    // Match pages/navigation helper keywords
    const allPages = [
      { name: 'Dashboard Overview', path: '/', keywords: ['dashboard', 'home', 'overview', 'main'] },
      { name: 'POS / Billing', path: '/billing', keywords: ['billing', 'pos', 'invoice', 'sale', 'sell', 'bill', 'new invoice'] },
      { name: 'Returns & Exchange', path: '/returns', keywords: ['returns', 'exchange', 'refund', 'return'] },
      { name: 'Products Catalog', path: '/products', keywords: ['products', 'catalog', 'stock', 'items', 'pricing'] },
      { name: 'Stock Adjustments', path: '/inventory', keywords: ['inventory', 'adjustments', 'logs', 'stock-in', 'stock-out'] },
      { name: 'Coupon Management', path: '/coupons', keywords: ['coupons', 'discounts', 'codes', 'promo'] },
      { name: 'WhatsApp Marketing', path: '/broadcast', keywords: ['broadcast', 'whatsapp', 'marketing', 'campaigns'] },
      { name: 'Customer Register', path: '/customers', keywords: ['customers', 'loyalty', 'clients'] },
      { name: 'Supplier Directory', path: '/suppliers', keywords: ['suppliers', 'vendors', 'distributors'] },
      { name: 'Reports & Analytics', path: '/reports', keywords: ['reports', 'analytics', 'charts', 'sales report', 'profit'] },
      { name: 'Settings & Admin', path: '/settings', keywords: ['settings', 'admin', 'staff', 'profile'] }
    ];

    if (req.user.role === 'SuperAdmin') {
      allPages.push({ name: 'SaaS Control Console', path: '/saas-admin', keywords: ['saas', 'admin', 'tenants', 'control', 'analytics'] });
    }

    const matchedPages = allPages.filter(page => 
      page.name.toLowerCase().includes(q.toLowerCase()) || 
      page.keywords.some(keyword => keyword.includes(q.toLowerCase()))
    ).slice(0, 5);

    res.status(200).json({
      success: true,
      results: {
        products,
        customers,
        pages: matchedPages,
        tenants
      }
    });
  } catch (error) {
    console.error('Error in global search:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
