const mongoose = require('mongoose');

const autoSeedSuperAdmin = async () => {
  try {
    const User = require('../models/User');
    const Tenant = require('../models/Tenant');

    // Check if any SuperAdmin exists in the system
    const superAdminExists = await User.findOne({ role: 'SuperAdmin' });
    if (!superAdminExists) {
      console.log('Auto-seed: No SuperAdmin found. Seeding default SaaS Admin...');

      // 1. Create or Find default Tenant (required for routing context)
      let defaultTenant = await Tenant.findOne({ slug: 'default-store' });
      if (!defaultTenant) {
        defaultTenant = await Tenant.create({
          name: 'Default Retail Store',
          slug: 'default-store',
          plan: 'Enterprise',
          status: 'Active',
        });
        console.log('Auto-seed: Default tenant created.');

        // Create default ShopProfile for default tenant
        const ShopProfile = require('../models/ShopProfile');
        await ShopProfile.create({
          name: defaultTenant.name,
          logo: '',
          gstin: '',
          address: '',
          email: 'admin@luminous.com',
          phone: '',
          tenant: defaultTenant._id,
        });
      }

      // 2. Create the default SuperAdmin user
      await User.create({
        name: 'SaaS Administrator',
        email: 'superadmin@luminous.com',
        password: 'superadmin123',
        role: 'SuperAdmin',
        active: true,
      });
      console.log('Auto-seed: Default SuperAdmin seeded successfully!');
    }
  } catch (error) {
    console.error('Auto-seed failed:', error.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luminous_ledger');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    // Run auto-seeding
    await autoSeedSuperAdmin();
  } catch (error) {
    console.error(`Database connection error: ${error.message}. Retrying in 5 seconds...`);
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
