const { metricsMiddleware, metricsEndpoint } = require('./src/telemetry');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const routes = require('./src/routes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const rateLimiter = require('./src/middleware/rateLimiter');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use((req, res, next) => {
  // Skip body parsing for proxied routes — proxy needs raw body
  if (req.path.startsWith('/api/orders') || 
      req.path.startsWith('/api/payments') ||
      req.path.startsWith('/api/restaurants') ||
      req.path.startsWith('/api/notifications')) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/orders') || 
      req.path.startsWith('/api/payments') ||
      req.path.startsWith('/api/restaurants') ||
      req.path.startsWith('/api/notifications')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});
app.use(rateLimiter);
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'api-gateway',
        status: 'running',
        port: process.env.PORT || 3000,
        services: {
            users: process.env.USER_SERVICE_URL,
            restaurants: process.env.RESTAURANT_SERVICE_URL,
            orders: process.env.ORDER_SERVICE_URL,
            payments: process.env.PAYMENT_SERVICE_URL,
            notifications: process.env.NOTIFICATION_SERVICE_URL,
        }
    });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API Gateway running on port ${PORT}`);
});