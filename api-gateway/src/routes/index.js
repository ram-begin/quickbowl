const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { withCircuitBreaker, getCircuitStatus } = require('../middleware/circuitBreaker');
require('dotenv').config();

const router = express.Router();

// Circuit status endpoint
router.get('/circuit-status', (req, res) => {
    res.json({ success: true, data: getCircuitStatus() });
});

// Helper — creates a proxy function wrapped in a circuit breaker
const makeProxy = (target, pathRewrite) => {
    const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        followRedirects: true,
        pathRewrite,
        on: {
            error: (err, req, res) => {
                if (!res.headersSent) {
                    res.status(503).json({ success: false, message: 'Service unavailable' });
                }
            }
        }
    });
    return (req, res, next) => proxy(req, res, next);
};

// User Service
router.use('/users', withCircuitBreaker(
    'user-service',
    makeProxy(process.env.USER_SERVICE_URL, { '^/api/users': '/api/users' })
));

// Restaurant Service
router.use('/restaurants', withCircuitBreaker(
    'restaurant-service',
    makeProxy(process.env.RESTAURANT_SERVICE_URL, { '^/api/restaurants': '/api/restaurants' })
));

// Order Service
router.use('/orders', withCircuitBreaker(
    'order-service',
    makeProxy(process.env.ORDER_SERVICE_URL, { '^/api/orders': '/api/orders' })
));

// Payment Service
router.use('/payments', withCircuitBreaker(
    'payment-service',
    makeProxy(process.env.PAYMENT_SERVICE_URL, { '^/api/payments': '/api/payments' })
));

// Notification Service
router.use('/notifications', withCircuitBreaker(
    'notification-service',
    makeProxy(process.env.NOTIFICATION_SERVICE_URL, { '^/api/notifications': '/api/notifications' })
));

module.exports = router;