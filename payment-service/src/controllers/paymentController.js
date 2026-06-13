const { pool } = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { publishPaymentEvent } = require('../kafka/producer');

require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Create Payment Order ──────────────────────────────
const createPayment = async (req, res) => {
    const { order_id, user_id, amount } = req.body;

    if (!order_id || !user_id || !amount) {
        return res.status(400).json({
            success: false,
            message: 'order_id, user_id and amount are required'
        });
    }

    try {
        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(amount * 100), // in paise
            currency: 'INR',
            receipt: `receipt_${uuidv4()}`,
        });

        // Save to DB
        const result = await pool.query(
            `INSERT INTO payments (order_id, user_id, amount, razorpay_order_id, status)
             VALUES ($1, $2, $3, $4, 'CREATED') RETURNING *`,
            [order_id, user_id, amount, razorpayOrder.id]
        );

        res.json({
            success: true,
            message: 'Payment order created',
            data: {
                payment: result.rows[0],
                razorpay: {
                    key: process.env.RAZORPAY_KEY_ID,
                    order_id: razorpayOrder.id,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Verify Payment ────────────────────────────────────
const verifyPayment = async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_method,
        user_email,   // pass these from frontend at verify time
        user_phone,
    } = req.body;

    try {
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        const isValid = expectedSignature === razorpay_signature;

        if (!isValid) {
            await pool.query(
                `UPDATE payments SET status='FAILED', failure_reason='Invalid signature', updated_at=NOW()
                 WHERE razorpay_order_id=$1`,
                [razorpay_order_id]
            );
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        const result = await pool.query(
            `UPDATE payments SET 
                status='SUCCESS',
                razorpay_payment_id=$1,
                razorpay_signature=$2,
                payment_method=$3,
                updated_at=NOW()
             WHERE razorpay_order_id=$4 RETURNING *`,
            [razorpay_payment_id, razorpay_signature, payment_method, razorpay_order_id]
        );

        const payment = result.rows[0];

        // Publish to Kafka (fire-and-forget — don't fail the response if Kafka is down)
        publishPaymentEvent('payment.completed', {
            type: 'payment_success',
            user: {
                id: payment.user_id,
                email: user_email || null,
                phone: user_phone || null,
            },
            paymentDetails: {
                orderId: payment.order_id,
                amount: payment.amount,
                paymentId: payment.razorpay_payment_id,
                method: payment_method,
            },
        }).catch(err => console.error('Kafka publish failed (non-fatal):', err.message));

        res.json({
            success: true,
            message: 'Payment verified successfully',
            data: payment,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Refund Payment ────────────────────────────────────
const refundPayment = async (req, res) => {
    const { id } = req.params;
    const { reason, amount, user_email, user_phone } = req.body;

    try {
        const paymentResult = await pool.query('SELECT * FROM payments WHERE id=$1', [id]);
        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        const payment = paymentResult.rows[0];

        if (payment.status !== 'SUCCESS') {
            return res.status(400).json({ success: false, message: 'Only successful payments can be refunded' });
        }

        if (payment.refund_status === 'REFUNDED') {
            return res.status(400).json({ success: false, message: 'Payment already refunded' });
        }

        const refundAmount = amount || payment.amount;

        const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
            amount: Math.round(refundAmount * 100),
            notes: { reason: reason || 'Order cancelled' },
        });

        const result = await pool.query(
            `UPDATE payments SET
                refund_id=$1,
                refund_amount=$2,
                refund_status='REFUNDED',
                refund_reason=$3,
                refunded_at=NOW(),
                status='REFUNDED',
                updated_at=NOW()
             WHERE id=$4 RETURNING *`,
            [refund.id, refundAmount, reason, id]
        );

        const updatedPayment = result.rows[0];

        // Publish to Kafka
        publishPaymentEvent('payment.refunded', {
            type: 'payment_refund',
            user: {
                id: updatedPayment.user_id,
                email: user_email || null,
                phone: user_phone || null,
            },
            paymentDetails: {
                orderId: updatedPayment.order_id,
                amount: refundAmount,
                refundId: refund.id,
                reason: reason || 'Order cancelled',
            },
        }).catch(err => console.error('Kafka publish failed (non-fatal):', err.message));

        res.json({
            success: true,
            message: `Refund of ₹${refundAmount} processed successfully`,
            data: updatedPayment,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get Payment by ID
const getPayment = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM payments WHERE id=$1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get Payments by Order
const getPaymentByOrder = async (req, res) => {
    const { orderId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM payments WHERE order_id=$1 ORDER BY created_at DESC',
            [orderId]
        );
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get Payments by User
const getPaymentsByUser = async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Settlement Report
const getSettlementReport = async (req, res) => {
    const { restaurantId } = req.params;
    const { start, end } = req.query;
    try {
        const startDate = start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = end || new Date().toISOString();
        const result = await pool.query(
            `SELECT 
                COUNT(*) as total_orders,
                SUM(amount) as gross_amount,
                SUM(amount * $1 / 100) as platform_fee,
                SUM(amount * (100 - $1) / 100) as net_amount
             FROM payments
             WHERE order_id IN (
                SELECT id::text FROM payments WHERE created_at BETWEEN $2 AND $3
             )
             AND status = 'SUCCESS'`,
            [process.env.PLATFORM_FEE_PERCENT || 2, startDate, endDate]
        );
        res.json({
            success: true,
            restaurant_id: restaurantId,
            period: { start: startDate, end: endDate },
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    createPayment,
    verifyPayment,
    getPayment,
    getPaymentByOrder,
    getPaymentsByUser,
    refundPayment,
    getSettlementReport
};