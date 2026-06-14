const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['SuperAdmin', 'Admin', 'Manager', 'Cashier'],
      default: 'Cashier',
    },
    active: {
      type: Boolean,
      default: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: function () {
        return this.role !== 'SuperAdmin';
      },
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    permissions: {
      type: [String],
      default: function () {
        if (this.role === 'Admin') {
          return [
            'dashboard',
            'billing',
            'returns',
            'products',
            'inventory',
            'coupons',
            'broadcast',
            'customers',
            'suppliers',
            'reports',
            'settings',
          ];
        }
        if (this.role === 'Manager') {
          return [
            'dashboard',
            'billing',
            'returns',
            'products',
            'inventory',
            'coupons',
            'broadcast',
            'customers',
            'suppliers',
            'reports',
          ];
        }
        return ['dashboard', 'billing', 'returns'];
      },
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
