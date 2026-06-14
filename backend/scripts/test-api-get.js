const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { getTenants } = require('../controllers/saasController');

dotenv.config({ path: path.join(__dirname, '../.env') });

const testGetTenants = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const req = {};
    const res = {
      status: function(code) {
        console.log('Status code:', code);
        return this;
      },
      json: function(data) {
        console.log('JSON Output:');
        console.dir(data, { depth: null });
      }
    };
    await getTenants(req, res);
    mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};

testGetTenants();
