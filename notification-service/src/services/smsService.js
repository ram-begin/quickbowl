require('dotenv').config();

const getSMSClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !accountSid.startsWith('AC')) {
        return null; // Twilio not configured
    }

    const twilio = require('twilio');
    return twilio(accountSid, authToken);
};

const sendSMS = async ({ to, message }) => {
    try {
        const client = getSMSClient();

        if (!client) {
            console.log(`⚠️ SMS skipped (Twilio not configured): ${message}`);
            return { success: false, error: 'Twilio not configured' };
        }

        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE,
            to,
        });
        console.log(`✅ SMS sent to ${to}: ${result.sid}`);
        return { success: true, sid: result.sid };
    } catch (err) {
        console.error(`❌ SMS failed:`, err.message);
        return { success: false, error: err.message };
    }
};

// SMS templates
const smsTemplates = {
    orderPlaced: (orderDetails) =>
        `${process.env.APP_NAME}: Your order #${orderDetails.order_id} has been placed! Amount: ₹${orderDetails.amount}. Track your order in the app.`,

    orderAccepted: (orderDetails) =>
        `${process.env.APP_NAME}: Your order #${orderDetails.order_id} has been accepted by the restaurant and is being prepared!`,

    orderOutForDelivery: (orderDetails) =>
        `${process.env.APP_NAME}: Your order #${orderDetails.order_id} is out for delivery! Get ready!`,

    orderDelivered: (orderDetails) =>
        `${process.env.APP_NAME}: Your order #${orderDetails.order_id} has been delivered. Enjoy your meal!`,

    paymentSuccess: (paymentDetails) =>
        `${process.env.APP_NAME}: Payment of ₹${paymentDetails.amount} received successfully. Transaction ID: ${paymentDetails.payment_id}`,

    refundProcessed: (refundDetails) =>
        `${process.env.APP_NAME}: Refund of ₹${refundDetails.amount} has been processed. It will reflect in 5-7 business days.`,
};

module.exports = { sendSMS, smsTemplates };