const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

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

const clearDB = async () => {
  try {
    console.log('Connecting to database to clear data...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Database connected!');

    // Clear transactional and catalog data
    console.log('Clearing catalog, transaction, log, and customer collections...');
    await Product.deleteMany({});
    await Customer.deleteMany({});
    await Supplier.deleteMany({});
    await Invoice.deleteMany({});
    await Transaction.deleteMany({});
    await InventoryLog.deleteMany({});
    await Notification.deleteMany({});
    await ActivityLog.deleteMany({});
    console.log('Collections cleared!');

    // Clear and recreate staff users to guarantee fresh start
    console.log('Re-initializing default staff accounts...');
    await User.deleteMany({});
    
    const defaultStaffPassword = process.env.SEED_PASSWORD || 'password123';

    await User.create({
      name: 'Alex Morgan',
      email: 'admin@luminous.com',
      password: defaultStaffPassword,
      role: 'Admin',
      active: true,
    });

    await User.create({
      name: 'Sarah Connor',
      email: 'manager@luminous.com',
      password: defaultStaffPassword,
      role: 'Manager',
      active: true,
    });

    await User.create({
      name: 'John Doe',
      email: 'cashier@luminous.com',
      password: defaultStaffPassword,
      role: 'Cashier',
      active: true,
    });

    console.log('Staff logins initialized successfully!');
    console.log('Database is now fresh, empty, and ready for use!');
    mongoose.connection.close();
  } catch (error) {
    console.error(`Error clearing database: ${error.message}`);
    mongoose.connection.close();
    process.exit(1);
  }
};

clearDB();
