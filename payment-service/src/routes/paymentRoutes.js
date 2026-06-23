const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
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

// POST /api/payments/boost
router.post('/boost', authMiddleware, async (req, res) => {
  try {
    const { restaurant_id } = req.body;
    const order = await razorpay.orders.create({
      amount: 1900, // ₹19 in paise
      currency: 'INR',
      receipt: `boost_${restaurant_id}_${Date.now()}`
    });
    res.json({
      success: true,
      data: {
        razorpay: {
          key: process.env.RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          order_id: order.id
        }
      }
    });
  } catch(e) { res.status(500).json({ success: false, message: 'Could not create order' }); }
});

// POST /api/payments/boost/verify
router.post('/boost/verify', authMiddleware, async (req, res) => {
  try {
    const { restaurant_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.json({ success: false, message: 'Invalid signature' });
    }

    // Activate boost directly on restaurant
    const now = new Date();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await fetch(`${process.env.RESTAURANT_SERVICE_URL}/api/restaurants/${restaurant_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boost_active: true,
        boost_start:      now.toISOString(),
        boost_end:        end.toISOString(),
        boost_payment_id: razorpay_payment_id
      })
    });

    res.json({ success: true, message: 'Boost activated' });
  } catch(e) { res.status(500).json({ success: false, message: 'Verification failed' }); }
});

// Refund payment
router.post('/:id/refund', refundPayment);

// Get payments by order
router.get('/order/:orderId', getPaymentByOrder);

// Get payments by user
router.get('/user/:userId', getPaymentsByUser);

// Settlement report for restaurant
router.get('/settlement/:restaurantId', getSettlementReport);

// Get payment by ID
router.get('/:id', getPayment);

module.exports = router;