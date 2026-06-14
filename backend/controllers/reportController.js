const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');

// Helper to calculate transaction profit margin from its invoice
const getTransactionProfit = (trx) => {
  if (!trx.invoice) {
    // Fallback: 30% margin if no invoice reference
    return trx.amount * 0.3;
  }

  const inv = trx.invoice;
  let invProfit = 0;
  inv.items.forEach(item => {
    invProfit += item.quantity * (item.price - item.costPrice);
  });
  const netInvoiceProfit = Math.max(0, invProfit - inv.discount);
  const marginRatio = inv.grandTotal > 0 ? netInvoiceProfit / inv.grandTotal : 0;

  return trx.amount * marginRatio;
};

// @desc    Get dynamic dashboard metrics and weekly chart data
// @route   GET /api/reports/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();

    // Start and End of today
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // Start and End of yesterday
    const startOfYesterday = new Date(today);
    startOfYesterday.setDate(today.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(today);
    endOfYesterday.setDate(today.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);

    // Start of current month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Calculate Today's Sales from Transaction ledger (tenant-scoped)
    const todayTransactions = await Transaction.find({
      tenant: req.user.tenant,
      createdAt: { $gte: startOfToday, $lte: endOfToday },
      type: { $in: ['Sale', 'Refund'] },
    });
    let todaySales = 0;
    let todayCashSales = 0;
    let todayCardSales = 0;
    let todayUPISales = 0;

    todayTransactions.forEach((trx) => {
      const amount = trx.amount;
      const isSale = trx.type === 'Sale';
      const factor = isSale ? 1 : -1;

      todaySales += amount * factor;

      if (trx.paymentMethod === 'Cash') {
        todayCashSales += amount * factor;
      } else if (trx.paymentMethod === 'Card') {
        todayCardSales += amount * factor;
      } else if (trx.paymentMethod === 'UPI') {
        todayUPISales += amount * factor;
      }
    });

    // 2. Calculate Yesterday's Sales from Transaction ledger (tenant-scoped)
    const yesterdayTransactions = await Transaction.find({
      tenant: req.user.tenant,
      createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
      type: { $in: ['Sale', 'Refund'] },
    });
    const yesterdaySales = yesterdayTransactions.reduce((sum, trx) => {
      if (trx.type === 'Sale') return sum + trx.amount;
      if (trx.type === 'Refund') return sum - trx.amount;
      return sum;
    }, 0);

    // 3. Calculate Monthly Revenue from Transaction ledger (tenant-scoped)
    const monthlyTransactions = await Transaction.find({
      tenant: req.user.tenant,
      createdAt: { $gte: startOfMonth },
      type: { $in: ['Sale', 'Refund'] },
    });
    let monthlyRevenue = 0;
    let monthlyCashSales = 0;
    let monthlyCardSales = 0;
    let monthlyUPISales = 0;

    monthlyTransactions.forEach((trx) => {
      const amount = trx.amount;
      const isSale = trx.type === 'Sale';
      const factor = isSale ? 1 : -1;

      monthlyRevenue += amount * factor;

      if (trx.paymentMethod === 'Cash') {
        monthlyCashSales += amount * factor;
      } else if (trx.paymentMethod === 'Card') {
        monthlyCardSales += amount * factor;
      } else if (trx.paymentMethod === 'UPI') {
        monthlyUPISales += amount * factor;
      }
    });

    // 4. Calculate Low Stock Items (tenant-scoped, active, not soft deleted)
    const lowStockItemsCount = await Product.countDocuments({
      tenant: req.user.tenant,
      active: true,
      deletedAt: null,
      $expr: { $lte: ['$stock', '$minStockLevel'] },
    });

    // 5. Calculate Inventory Health (percentage of items in stock > min stock) (tenant-scoped)
    const totalActiveProducts = await Product.countDocuments({
      tenant: req.user.tenant,
      active: true,
      deletedAt: null,
    });
    const healthyProductsCount = totalActiveProducts - lowStockItemsCount;
    const inventoryHealth = totalActiveProducts > 0
      ? Math.round((healthyProductsCount / totalActiveProducts) * 100)
      : 100;

    // 6. Generate Weekly Revenue Chart Data (Last 7 Days) (tenant-scoped)
    const startOfRange = new Date(today);
    startOfRange.setDate(today.getDate() - 6);
    startOfRange.setHours(0, 0, 0, 0);

    const weeklyTransactions = await Transaction.find({
      tenant: req.user.tenant,
      createdAt: { $gte: startOfRange, $lte: endOfToday },
      type: { $in: ['Sale', 'Refund'] },
    }).populate({
      path: 'invoice',
      populate: { path: 'items.product' }
    });

    const weeklyChart = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      // Filter transactions for this day in-memory
      const dayTransactions = weeklyTransactions.filter(
        (trx) => trx.createdAt >= start && trx.createdAt <= end
      );

      const dayGrossRevenue = dayTransactions.reduce((sum, trx) => {
        if (trx.type === 'Sale') return sum + trx.amount;
        if (trx.type === 'Refund') return sum - trx.amount;
        return sum;
      }, 0);

      let dayNetProfit = 0;
      dayTransactions.forEach(trx => {
        const profit = getTransactionProfit(trx);
        if (trx.type === 'Sale') {
          dayNetProfit += profit;
        } else if (trx.type === 'Refund') {
          dayNetProfit -= profit;
        }
      });

      weeklyChart.push({
        day: daysOfWeek[date.getDay()],
        date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        revenue: parseFloat(dayGrossRevenue.toFixed(2)),
        profit: parseFloat(dayNetProfit.toFixed(2)),
      });
    }

    // 7. Get Recent Transactions (grouping split components of the same invoice together) (tenant-scoped)
    const rawTransactions = await Transaction.find({ tenant: req.user.tenant })
      .populate('cashier', 'name')
      .populate('invoice', 'invoiceNumber')
      .sort('-createdAt')
      .limit(50);

    const groupedMap = new Map();
    rawTransactions.forEach(trx => {
      const invoiceNum = trx.invoice?.invoiceNumber || trx.referenceId || trx.transactionNumber;
      const key = `${invoiceNum}_${trx.type}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          _id: trx._id,
          transactionNumber: trx.transactionNumber,
          invoice: trx.invoice,
          referenceId: trx.referenceId,
          type: trx.type,
          createdAt: trx.createdAt,
          amount: 0,
          paymentMethods: new Set(),
          cashier: trx.cashier
        });
      }
      const group = groupedMap.get(key);
      group.amount += trx.amount;
      if (trx.paymentMethod) {
        group.paymentMethods.add(trx.paymentMethod);
      }
    });

    const recentTransactions = Array.from(groupedMap.values()).map(group => {
      const methods = Array.from(group.paymentMethods);
      return {
        _id: group._id,
        transactionNumber: group.transactionNumber,
        invoice: group.invoice,
        referenceId: group.referenceId,
        type: group.type,
        createdAt: group.createdAt,
        amount: parseFloat(group.amount.toFixed(2)),
        paymentMethod: methods.length > 1 ? methods.join(' + ') : (methods[0] || 'N/A'),
        cashier: group.cashier
      };
    }).slice(0, 5);

    res.status(200).json({
      success: true,
      kpis: {
        todaySales: parseFloat(todaySales.toFixed(2)),
        todayCashSales: parseFloat(todayCashSales.toFixed(2)),
        todayCardSales: parseFloat(todayCardSales.toFixed(2)),
        todayUPISales: parseFloat(todayUPISales.toFixed(2)),
        yesterdaySales: parseFloat(yesterdaySales.toFixed(2)),
        monthlyRevenue: parseFloat(monthlyRevenue.toFixed(2)),
        monthlyCashSales: parseFloat(monthlyCashSales.toFixed(2)),
        monthlyCardSales: parseFloat(monthlyCardSales.toFixed(2)),
        monthlyUPISales: parseFloat(monthlyUPISales.toFixed(2)),
        lowStockItems: lowStockItemsCount,
        inventoryHealth,
      },
      weeklyChart,
      recentTransactions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get custom date range reports and analytics
// @route   GET /api/reports/analytics
// @access  Private
exports.getAnalyticsReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {
      tenant: req.user.tenant,
      type: { $in: ['Sale', 'Refund'] }
    };
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

    const transactions = await Transaction.find(query).populate({
      path: 'invoice',
      populate: { path: 'items.product' }
    });

    let totalRevenue = 0;
    let totalCashSales = 0;
    let totalCardSales = 0;
    let totalUPISales = 0;
    let totalTaxCollected = 0;
    let totalCOGS = 0;
    let totalDiscount = 0;
    const categorySales = {};
    const productSales = {};

    transactions.forEach((trx) => {
      const isSale = trx.type === 'Sale';
      const factor = isSale ? 1 : -1;
      const amount = trx.amount;

      totalRevenue += amount * factor;

      if (trx.paymentMethod === 'Cash') {
        totalCashSales += amount * factor;
      } else if (trx.paymentMethod === 'Card') {
        totalCardSales += amount * factor;
      } else if (trx.paymentMethod === 'UPI') {
        totalUPISales += amount * factor;
      }

      if (trx.invoice) {
        const inv = trx.invoice;
        const ratio = inv.grandTotal > 0 ? amount / inv.grandTotal : 0;

        totalTaxCollected += inv.taxTotal * ratio * factor;
        totalDiscount += inv.discount * ratio * factor;

        inv.items.forEach((item) => {
          const itemQty = item.quantity * ratio;
          totalCOGS += itemQty * item.costPrice * factor;

          // Group by product SKU
          if (!productSales[item.sku]) {
            productSales[item.sku] = {
              sku: item.sku,
              name: item.name,
              quantity: 0,
              revenue: 0,
              profit: 0,
            };
          }
          productSales[item.sku].quantity += itemQty * factor;
          const unitTotal = item.total / item.quantity;
          productSales[item.sku].revenue += (unitTotal * ratio) * factor;
          productSales[item.sku].profit += (itemQty * (item.price - item.costPrice)) * factor;
        });
      } else {
        // Fallback if no invoice reference
        totalCOGS += amount * 0.7 * factor;
      }
    });

    const netProfit = totalRevenue - totalCOGS - totalTaxCollected;

    // Top Selling Products sorted by quantity
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Generate product categories aggregate for chart
    const activeProducts = await Product.find({ tenant: req.user.tenant, active: true, deletedAt: null });
    activeProducts.forEach((p) => {
      if (p.category) {
        categorySales[p.category] = (categorySales[p.category] || 0) + p.stock;
      }
    });

    // Predictive restocking alerts (Items critically low that have sales velocity)
    const lowStockAlerts = await Product.find({
      tenant: req.user.tenant,
      active: true,
      deletedAt: null,
      $expr: { $lte: ['$stock', '$minStockLevel'] },
    }).populate('supplier', 'name contactPerson phone');

    const restockRecommendations = lowStockAlerts.map(product => {
      return {
        id: product._id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        minLevel: product.minStockLevel,
        supplierName: product.supplier ? product.supplier.name : 'No Supplier Assigned',
        contactPerson: product.supplier ? product.supplier.contactPerson : '',
        phone: product.supplier ? product.supplier.phone : '',
        suggestedRestockQty: Math.max(20, product.minStockLevel * 2 - product.stock),
      };
    });

    res.status(200).json({
      success: true,
      summary: {
        totalSales: parseFloat(totalRevenue.toFixed(2)),
        totalCashSales: parseFloat(totalCashSales.toFixed(2)),
        totalCardSales: parseFloat(totalCardSales.toFixed(2)),
        totalUPISales: parseFloat(totalUPISales.toFixed(2)),
        totalTaxCollected: parseFloat(totalTaxCollected.toFixed(2)),
        totalCOGS: parseFloat(totalCOGS.toFixed(2)),
        totalDiscount: parseFloat(totalDiscount.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
      },
      topProducts,
      categoryInventory: Object.entries(categorySales).map(([name, stock]) => ({ name, value: stock })),
      restockRecommendations,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
