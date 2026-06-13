const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendEmail = async ({ to, subject, html }) => {
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`✅ Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`❌ Email failed:`, err.message);
        return { success: false, error: err.message };
    }
};

// Email templates
const templates = {
    orderPlaced: (orderDetails) => ({
        subject: `🍽️ Order Confirmed - ${process.env.APP_NAME}`,
        html: `
            <h2>Your order has been placed!</h2>
            <p>Order ID: <strong>${orderDetails.order_id}</strong></p>
            <p>Amount: <strong>₹${orderDetails.amount}</strong></p>
            <p>Status: <strong>Confirmed</strong></p>
            <p>Thank you for ordering from ${process.env.APP_NAME}!</p>
        `
    }),

    orderDelivered: (orderDetails) => ({
        subject: `✅ Order Delivered - ${process.env.APP_NAME}`,
        html: `
            <h2>Your order has been delivered!</h2>
            <p>Order ID: <strong>${orderDetails.order_id}</strong></p>
            <p>We hope you enjoyed your meal!</p>
        `
    }),

    paymentSuccess: (paymentDetails) => ({
        subject: `💳 Payment Successful - ${process.env.APP_NAME}`,
        html: `
            <h2>Payment Confirmed!</h2>
            <p>Amount Paid: <strong>₹${paymentDetails.amount}</strong></p>
            <p>Transaction ID: <strong>${paymentDetails.payment_id}</strong></p>
        `
    }),

    refundProcessed: (refundDetails) => ({
        subject: `💰 Refund Processed - ${process.env.APP_NAME}`,
        html: `
            <h2>Your refund has been processed!</h2>
            <p>Refund Amount: <strong>₹${refundDetails.amount}</strong></p>
            <p>It will reflect in your account within 5-7 business days.</p>
        `
    }),
};

module.exports = { sendEmail, templates };