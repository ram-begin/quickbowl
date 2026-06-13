const express = require('express');
const router = express.Router();
const {
    sendOrderNotification,
    sendPaymentNotification,
    sendCustomNotification,
} = require('../controllers/notificationController');

// Order notifications (placed, accepted, out for delivery, delivered)
router.post('/order', sendOrderNotification);

// Payment notifications (success, refund)
router.post('/payment', sendPaymentNotification);

// Custom notification
router.post('/custom', sendCustomNotification);

module.exports = router;