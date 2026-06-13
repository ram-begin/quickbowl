const express = require('express');
const router = express.Router();
const {
    createPayment,
    verifyPayment,
    getPayment,
    getPaymentByOrder,
    getPaymentsByUser,
    refundPayment,
    getSettlementReport
} = require('../controllers/paymentController');

// Create payment order
router.post('/', createPayment);

// Verify payment after Razorpay callback
router.post('/verify', verifyPayment);

// Get payment by ID
router.get('/:id', getPayment);

// Get payments by order
router.get('/order/:orderId', getPaymentByOrder);

// Get payments by user
router.get('/user/:userId', getPaymentsByUser);

// Refund payment
router.post('/:id/refund', refundPayment);

// Settlement report for restaurant
router.get('/settlement/:restaurantId', getSettlementReport);

module.exports = router;