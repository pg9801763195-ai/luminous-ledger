const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Models
const Tenant = require('../models/Tenant');
const ShopProfile = require('../models/ShopProfile');

dotenv.config({ path: path.join(__dirname, '../.env') });

const fixProfiles = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luminous_ledger');
    console.log('Connected!');

    const profiles = await ShopProfile.find({});
    console.log(`Found ${profiles.length} shop profiles.`);

    for (const profile of profiles) {
      const tenant = await Tenant.findById(profile.tenant);
      if (!tenant) {
        console.log(`Profile ${profile._id} has no valid tenant!`);
        continue;
      }

      console.log(`Checking profile for tenant: ${tenant.name} (${tenant.slug})`);

      let updated = false;

      // If this is NOT the default store, but the name is still the old default
      if (tenant.slug !== 'default-store') {
        if (profile.name === 'Shree Shyam Saawariya' || profile.name === 'Shree Shyam Sanwaria' || profile.name === 'Default Retail Store') {
          console.log(`- Updating name from "${profile.name}" to "${tenant.name}"`);
          profile.name = tenant.name;
          updated = true;
        }
        if (profile.email === 'support@shreeshyamsaawariya.com' || profile.email === 'support@shreeshyamsanwaria.com') {
          console.log(`- Clearing email`);
          profile.email = '';
          updated = true;
        }
        if (profile.phone === '+91 9999999999') {
          console.log(`- Clearing phone`);
          profile.phone = '';
          updated = true;
        }
        if (profile.gstin === '27AAAAA1111A1Z1') {
          console.log(`- Clearing gstin`);
          profile.gstin = '';
          updated = true;
        }
        if (profile.address === '123 Retail Lane, Hub Plaza') {
          console.log(`- Clearing address`);
          profile.address = '';
          updated = true;
        }
      } else {
        // Ensure default store has the correct name "Shree Shyam Saawariya"
        if (profile.name === 'Default Retail Store' || profile.name === 'Shree Shyam Sanwaria') {
          console.log(`- Resetting default store name to "Shree Shyam Saawariya"`);
          profile.name = 'Shree Shyam Saawariya';
          updated = true;
        }
      }

      if (updated) {
        await profile.save();
        console.log(`Saved profile changes for ${tenant.name}.`);
      }
    }

    console.log('Done fixing shop profiles!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to fix profiles:', error);
    process.exit(1);
  }
};

fixProfiles();
