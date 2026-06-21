const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Models
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const InventoryLog = require('../models/InventoryLog');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Coupon = require('../models/Coupon');
const ShopProfile = require('../models/ShopProfile');

dotenv.config({ path: path.join(__dirname, '../.env') });

const migrate = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luminous_ledger');
    console.log('Connected!');

    // 1. Create or Find default Tenant
    let defaultTenant = await Tenant.findOne({ slug: 'default-store' });
    if (!defaultTenant) {
      console.log('Creating default tenant...');
      defaultTenant = await Tenant.create({
        name: 'Default Retail Store',
        slug: 'default-store',
        plan: 'Enterprise',
        status: 'Active',
      });
      console.log(`Default tenant created: ${defaultTenant._id}`);
    } else {
      console.log(`Default tenant already exists: ${defaultTenant._id}`);
    }

    const tenantId = defaultTenant._id;

    // 2. Create SuperAdmin if it doesn't exist
    const superAdminEmail = 'superadmin@luminous.com';
    let superAdmin = await User.findOne({ email: superAdminEmail });
    if (!superAdmin) {
      console.log('Creating SuperAdmin user...');
      const initialPassword = process.env.INITIAL_SUPERADMIN_PASSWORD || 'superadmin123';
      superAdmin = await User.create({
        name: 'SaaS Administrator',
        email: superAdminEmail,
        password: initialPassword,
        role: 'SuperAdmin',
        active: true,
      });
      console.log(`SuperAdmin user created! Log in with superadmin@luminous.com`);
    } else {
      // Ensure role is SuperAdmin
      if (superAdmin.role !== 'SuperAdmin') {
        superAdmin.role = 'SuperAdmin';
        await superAdmin.save();
        console.log('Updated existing user with superadmin email to SuperAdmin role.');
      }
      console.log('SuperAdmin user already exists.');
    }

    // 3. Migrate Users (non-SuperAdmin)
    console.log('Migrating users...');
    const usersRes = await User.updateMany(
      { role: { $ne: 'SuperAdmin' }, tenant: { $exists: false } },
      { $set: { tenant: tenantId, deletedAt: null } }
    );
    await User.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );
    console.log(`Migrated ${usersRes.modifiedCount} users.`);

    // 4. Migrate Shop Profiles
    console.log('Migrating shop profiles...');
    const shopRes = await ShopProfile.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId } }
    );
    console.log(`Migrated ${shopRes.modifiedCount} shop profiles.`);

    // 5. Migrate Products
    console.log('Migrating products...');
    const prodRes = await Product.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId, deletedAt: null } }
    );
    await Product.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );
    console.log(`Migrated ${prodRes.modifiedCount} products.`);

    // 6. Migrate Customers
    console.log('Migrating customers...');
    const custRes = await Customer.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId, deletedAt: null } }
    );
    await Customer.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );
    console.log(`Migrated ${custRes.modifiedCount} customers.`);

    // 7. Migrate Suppliers
    console.log('Migrating suppliers...');
    const suppRes = await Supplier.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId, deletedAt: null } }
    );
    await Supplier.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );
    console.log(`Migrated ${suppRes.modifiedCount} suppliers.`);

    // 8. Migrate Invoices
    console.log('Migrating invoices...');
    const invRes = await Invoice.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId, deletedAt: null } }
    );
    await Invoice.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );
    console.log(`Migrated ${invRes.modifiedCount} invoices.`);

    // 9. Migrate Transactions
    console.log('Migrating transactions...');
    const trxRes = await Transaction.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId, deletedAt: null } }
    );
    await Transaction.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );
    console.log(`Migrated ${trxRes.modifiedCount} transactions.`);

    // 10. Migrate Inventory Logs
    console.log('Migrating inventory logs...');
    const invLogRes = await InventoryLog.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId } }
    );
    console.log(`Migrated ${invLogRes.modifiedCount} inventory logs.`);

    // 11. Migrate Notifications
    console.log('Migrating notifications...');
    const notifRes = await Notification.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId } }
    );
    console.log(`Migrated ${notifRes.modifiedCount} notifications.`);

    // 12. Migrate Activity Logs
    console.log('Migrating activity logs...');
    const actLogRes = await ActivityLog.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId } }
    );
    console.log(`Migrated ${actLogRes.modifiedCount} activity logs.`);

    // 13. Migrate Coupons
    console.log('Migrating coupons...');
    const couponRes = await Coupon.updateMany(
      { tenant: { $exists: false } },
      { $set: { tenant: tenantId, deletedAt: null } }
    );
    await Coupon.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );
    console.log(`Migrated ${couponRes.modifiedCount} coupons.`);

    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
