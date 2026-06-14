const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

// Models
const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const seedDB = async () => {
  try {
    console.log('Connecting to database for seeding...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luminous_ledger');
    console.log('Database connected!');

    // Clear existing data
    console.log('Clearing database collections...');
    await User.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});
    await Supplier.deleteMany({});
    await Invoice.deleteMany({});
    await Transaction.deleteMany({});
    await InventoryLog.deleteMany({});
    await Notification.deleteMany({});
    await ActivityLog.deleteMany({});
    console.log('Database cleared!');

    // 1. Seed Staff Users
    console.log('Seeding staff users...');
    const admin = await User.create({
      name: 'Alex Morgan',
      email: 'admin@luminous.com',
      password: 'password123', // encrypted via Pre-save hook
      role: 'Admin',
      active: true,
    });

    const manager = await User.create({
      name: 'Sarah Connor',
      email: 'manager@luminous.com',
      password: 'password123',
      role: 'Manager',
      active: true,
    });

    const cashier = await User.create({
      name: 'John Doe',
      email: 'cashier@luminous.com',
      password: 'password123',
      role: 'Cashier',
      active: true,
    });
    console.log('Staff users seeded!');

    // 2. Seed Suppliers
    console.log('Seeding suppliers...');
    const supplierApex = await Supplier.create({
      name: 'Apex Apparel Group',
      contactPerson: 'Robert Downey',
      email: 'robert@apexapparel.com',
      phone: '555-9011',
      address: '10 Apparel Way, Boston, MA',
    });

    const supplierNova = await Supplier.create({
      name: 'Nova Electronics Ltd',
      contactPerson: 'Ada Lovelace',
      email: 'ada@novaelectronics.com',
      phone: '555-8822',
      address: '42 Silicon Blvd, Austin, TX',
    });

    const supplierQuantum = await Supplier.create({
      name: 'Quantum Home & Living',
      contactPerson: 'Bruce Banner',
      email: 'bruce@quantumgoods.com',
      phone: '555-7733',
      address: '8 Gamma Circle, Denver, CO',
    });
    console.log('Suppliers seeded!');

    // 3. Seed Products
    console.log('Seeding products...');
    const productsData = [
      {
        sku: 'APP-TSRT-BLK-L',
        name: 'Apex Black T-Shirt (L)',
        description: 'Premium heavyweight cotton t-shirt with signature fit.',
        category: 'Apparel',
        price: 35.0,
        costPrice: 15.0,
        stock: 80,
        minStockLevel: 15,
        supplier: supplierApex._id,
        mrp: 50.0,
      },
      {
        sku: 'APP-HDY-GRY-M',
        name: 'Apex Grey Hoodie (M)',
        description: 'Ultra-soft fleece hoodie, double-lined hood.',
        category: 'Apparel',
        price: 65.0,
        costPrice: 28.0,
        stock: 5, // Low stock triggers notification alert
        minStockLevel: 10,
        supplier: supplierApex._id,
        mrp: 90.0,
      },
      {
        sku: 'ELC-EARB-WRLS',
        name: 'Nova Wireless Earbuds X1',
        description: 'Active noise cancelling Bluetooth earbuds.',
        category: 'Electronics',
        price: 120.0,
        costPrice: 55.0,
        stock: 40,
        minStockLevel: 8,
        supplier: supplierNova._id,
        mrp: 160.0,
      },
      {
        sku: 'ELC-CHRG-FAST',
        name: 'Nova 65W GaN Charger',
        description: 'Dual port USB-C ultra-compact fast wall charger.',
        category: 'Electronics',
        price: 45.0,
        costPrice: 18.0,
        stock: 15,
        minStockLevel: 5,
        supplier: supplierNova._id,
        mrp: 60.0,
      },
      {
        sku: 'HOM-MUG-CERM',
        name: 'Quantum Ceramic Coffee Mug',
        description: 'Matte finish stoneware coffee cup, 14oz capacity.',
        category: 'Home & Living',
        price: 18.0,
        costPrice: 6.0,
        stock: 120,
        minStockLevel: 20,
        supplier: supplierQuantum._id,
        mrp: 25.0,
      },
      {
        sku: 'HOM-LAMP-DSK',
        name: 'Quantum LED Desk Lamp',
        description: 'Dimmable smart table lamp with integrated wireless charger.',
        category: 'Home & Living',
        price: 55.0,
        costPrice: 22.0,
        stock: 2, // Low stock alerts
        minStockLevel: 10,
        supplier: supplierQuantum._id,
        mrp: 75.0,
      },
      {
        sku: 'ACC-WATC-MINI',
        name: 'Apex Minimalist Watch',
        description: 'Slim dial analog watch with genuine leather strap.',
        category: 'Accessories',
        price: 150.0,
        costPrice: 65.0,
        stock: 25,
        minStockLevel: 5,
        supplier: supplierApex._id,
        mrp: 200.0,
      },
      {
        sku: 'ACC-WALL-LETH',
        name: 'Apex Leather Bifold Wallet',
        description: 'RFID blocking full-grain cowhide leather wallet.',
        category: 'Accessories',
        price: 45.0,
        costPrice: 20.0,
        stock: 60,
        minStockLevel: 12,
        supplier: supplierApex._id,
        mrp: 60.0,
      },
    ];

    const products = await Product.create(productsData);

    // Create Initial stock-in logs
    for (const p of products) {
      await InventoryLog.create({
        product: p._id,
        changeType: 'Stock-In',
        quantityChanged: p.stock,
        stockBefore: 0,
        stockAfter: p.stock,
        referenceId: 'Initial seeder stock',
        performedBy: admin._id,
      });

      // Create low stock notifications for the seeded items
      if (p.stock <= p.minStockLevel) {
        await Notification.create({
          type: 'Low Stock',
          message: `Product "${p.name}" (SKU: ${p.sku}) is running low on stock. Current level: ${p.stock} units.`,
          referenceId: p._id.toString(),
        });
      }
    }
    console.log('Products seeded!');

    // 4. Seed Customers
    console.log('Seeding customers...');
    const customerJordan = await Customer.create({
      name: 'Jordan Smith',
      email: 'jordan@gmail.com',
      phone: '555-0101',
      loyaltyPoints: 120,
    });

    const customerAnna = await Customer.create({
      name: 'Anna Lee',
      email: 'anna@gmail.com',
      phone: '555-0102',
      loyaltyPoints: 85,
    });

    const customerMarcus = await Customer.create({
      name: 'Marcus Vong',
      email: 'marcus@gmail.com',
      phone: '555-0103',
      loyaltyPoints: 210,
    });
    console.log('Customers seeded!');

    // 5. Seed Historical Invoices and Transactions (Last 7 Days)
    console.log('Seeding sales and transaction history for charts...');
    const paymentMethods = ['Cash', 'Card', 'UPI'];
    const customersList = [customerJordan, customerAnna, customerMarcus, null]; // Some guest checkouts
    
    // Seed invoices daily for last 7 days to populate weekly chart
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const saleDate = new Date();
      saleDate.setDate(saleDate.getDate() - dayOffset);

      // Create 2-4 invoices per day
      const salesPerDay = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < salesPerDay; i++) {
        // Pick random items
        const numItems = 1 + Math.floor(Math.random() * 3);
        const invoiceItems = [];
        let subtotal = 0;

        for (let j = 0; j < numItems; j++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const qty = 1 + Math.floor(Math.random() * 2);

          const itemTotal = product.price * qty;
          const itemTax = itemTotal * 0.18;

          invoiceItems.push({
            product: product._id,
            name: product.name,
            sku: product.sku,
            quantity: qty,
            price: product.price,
            costPrice: product.costPrice,
            tax: parseFloat(itemTax.toFixed(2)),
            total: parseFloat((itemTotal + itemTax).toFixed(2)),
          });
          subtotal += itemTotal;
        }

        const taxTotal = parseFloat((subtotal * 0.18).toFixed(2));
        const discount = Math.random() > 0.5 ? Math.floor(Math.random() * 10) : 0;
        const grandTotal = parseFloat((subtotal + taxTotal - discount).toFixed(2));
        const customer = customersList[Math.floor(Math.random() * customersList.length)];
        const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

        // Generate invoice number
        const dateStr = saleDate.getFullYear().toString() +
          (saleDate.getMonth() + 1).toString().padStart(2, '0') +
          saleDate.getDate().toString().padStart(2, '0');
        const invoiceNumber = `INV-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

        const invoice = new Invoice({
          invoiceNumber,
          customer: customer ? customer._id : null,
          cashier: cashier._id,
          items: invoiceItems,
          subtotal: parseFloat(subtotal.toFixed(2)),
          taxTotal,
          discount: parseFloat(discount.toFixed(2)),
          grandTotal,
          paymentMethod,
          paymentStatus: 'Paid',
          createdAt: saleDate,
          updatedAt: saleDate,
        });
        await invoice.save();

        // Transaction entry
        const transactionNumber = `TRX-${Math.floor(100000 + Math.random() * 900000)}`;
        await Transaction.create({
          transactionNumber,
          invoice: invoice._id,
          type: 'Sale',
          category: 'Income',
          amount: grandTotal,
          paymentMethod,
          referenceId: invoiceNumber,
          description: `POS Checkout - Cashier: ${cashier.name}`,
          cashier: cashier._id,
          createdAt: saleDate,
        });

        // Log stock sale change
        for (const item of invoiceItems) {
          const product = await Product.findById(item.product);
          if (product) {
            // Log inventory log change
            await InventoryLog.create({
              product: product._id,
              changeType: 'Sale',
              quantityChanged: -item.quantity,
              stockBefore: product.stock,
              stockAfter: Math.max(0, product.stock - item.quantity),
              referenceId: `Checkout Invoice ${invoiceNumber}`,
              performedBy: cashier._id,
              createdAt: saleDate,
            });
          }
        }
      }
    }

    console.log('Historical invoices and transactions seeded!');
    console.log('Seeding completed successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error(`Error during seeding: ${error.message}`);
    mongoose.connection.close();
    process.exit(1);
  }
};

seedDB();
