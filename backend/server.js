const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

// Load env variables
dotenv.config();

// Connect to Database
connectDB();

// Route files
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const supplierRoutes = require('./routes/suppliers');
const invoiceRoutes = require('./routes/invoices');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const activityRoutes = require('./routes/activities');
const couponRoutes = require('./routes/coupons');
const shopRoutes = require('./routes/shop');
const marketingRoutes = require('./routes/marketing');
const saasRoutes = require('./routes/saas');
const searchRoutes = require('./routes/search');

const app = express();

// 1. Security Headers
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:5000 http://localhost:5173;");
  next();
};
app.use(securityHeaders);

// Body parser middleware
app.use(express.json());

// Enable CORS
app.use(cors());

// 2. NoSQL Injection Sanitization
const mongoSanitize = (req, res, next) => {
  const sanitize = (obj) => {
    if (obj instanceof Object) {
      for (const key in obj) {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else {
          sanitize(obj[key]);
        }
      }
    }
  };
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
};
app.use(mongoSanitize);

// 3. Rate Limiters
const { apiRateLimiter, loginRateLimiter } = require('./middleware/rateLimiter');

// Limit auth routes: strict limit on login attempts
app.use('/api/auth/login', loginRateLimiter);

// Limit all other API routes
app.use('/api', apiRateLimiter);

// Basic Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
});

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api/search', searchRoutes);

// Test endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  // Direct all other requests to React routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
