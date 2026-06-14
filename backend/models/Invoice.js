const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  sku: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  returnedQuantity: {
    type: Number,
    default: 0,
  },
  price: {
    type: Number,
    required: true,
  },
  costPrice: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
    default: 0,
  },
  mrp: {
    type: Number,
    default: 0,
  },
  couponCode: {
    type: String,
    default: '',
  },
  couponDiscount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
});

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: false,
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [InvoiceItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    taxTotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Card', 'UPI', 'Mixed'],
      default: 'Cash',
    },
    paymentSplit: {
      Cash: { type: Number, default: 0 },
      Card: { type: Number, default: 0 },
      UPI: { type: Number, default: 0 },
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending', 'Refunded', 'Partially Refunded'],
      default: 'Paid',
    },
    refundReason: {
      type: String,
      default: '',
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    exchangeCredit: {
      type: Number,
      default: 0,
    },
    exchangedFromInvoice: {
      type: String,
      default: '',
    },
    shareToken: {
      type: String,
      default: () => require('crypto').randomBytes(16).toString('hex'),
      unique: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

InvoiceSchema.index({ invoiceNumber: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
