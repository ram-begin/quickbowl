const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const router = express.Router();

// ── User Service ──────────────────────────────────────
router.use('/users', createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '/api/users' },
    on: {
        error: (err, req, res) => {
            res.status(503).json({ success: false, message: 'User service unavailable' });
        }
    }
}));

// ── Restaurant Service ────────────────────────────────
router.use('/restaurants', createProxyMiddleware({
    target: process.env.RESTAURANT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/restaurants': '/api/restaurants' },
    on: {
        error: (err, req, res) => {
            res.status(503).json({ success: false, message: 'Restaurant service unavailable' });
        }
    }
}));

// ── Order Service ─────────────────────────────────────
router.use('/orders', createProxyMiddleware({
    target: process.env.ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '/api/orders' },
    on: {
        error: (err, req, res) => {
            res.status(503).json({ success: false, message: 'Order service unavailable' });
        }
    }
}));

// ── Payment Service ───────────────────────────────────
router.use('/payments', createProxyMiddleware({
    target: process.env.PAYMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/payments': '/api/payments' },
    on: {
        error: (err, req, res) => {
            res.status(503).json({ success: false, message: 'Payment service unavailable' });
        }
    }
}));

// ── Notification Service ──────────────────────────────
router.use('/notifications', createProxyMiddleware({
    target: process.env.NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/notifications': '/api/notifications' },
    on: {
        error: (err, req, res) => {
            res.status(503).json({ success: false, message: 'Notification service unavailable' });
        }
    }
}));

module.exports = router;