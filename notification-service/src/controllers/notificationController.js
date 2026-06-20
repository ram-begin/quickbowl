const { sendEmail, templates } = require('../services/emailService');
const { sendSMS, smsTemplates } = require('../services/smsService');

// ── Send Order Notification ───────────────────────────
const sendOrderNotification = async (req, res) => {
    const { type, user, orderDetails } = req.body;

    if (!type || !user || !orderDetails) {
        return res.status(400).json({
            success: false,
            message: 'type, user and orderDetails are required'
        });
    }

    try {
        const results = {};

        // Send Email
        if (user.email) {
            const template = templates[type] ? templates[type](orderDetails) : null;
            if (template) {
                results.email = await sendEmail({
                    to: user.email,
                    subject: template.subject,
                    html: template.html,
                });
            }
        }

        // Send SMS
        if (user.phone) {
            const smsText = smsTemplates[type] ? smsTemplates[type](orderDetails) : null;
            if (smsText) {
                results.sms = await sendSMS({
                    to: user.phone,
                    message: smsText,
                });
            }
        }

        // Send real-time via Socket.io
        const io = req.app.get('io');
        if (io && user.id) {
            io.to(`user_${user.id}`).emit('notification', {
                type,
                orderDetails,
                timestamp: new Date(),
            });
            results.socket = true;
        }

        res.json({
            success: true,
            message: 'Notifications sent',
            results,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Send Payment Notification ─────────────────────────
const sendPaymentNotification = async (req, res) => {
    const { type, user, paymentDetails } = req.body;

    if (!type || !user || !paymentDetails) {
        return res.status(400).json({
            success: false,
            message: 'type, user and paymentDetails are required'
        });
    }

    try {
        const results = {};

        if (user.email) {
            const template = templates[type] ? templates[type](paymentDetails) : null;
            if (template) {
                results.email = await sendEmail({
                    to: user.email,
                    subject: template.subject,
                    html: template.html,
                });
            }
        }

        if (user.phone) {
            const smsText = smsTemplates[type] ? smsTemplates[type](paymentDetails) : null;
            if (smsText) {
                results.sms = await sendSMS({
                    to: user.phone,
                    message: smsText,
                });
            }
        }

        const io = req.app.get('io');
        if (io && user.id) {
            io.to(`user_${user.id}`).emit('notification', {
                type,
                paymentDetails,
                timestamp: new Date(),
            });
            results.socket = true;
        }

        res.json({
            success: true,
            message: 'Payment notification sent',
            results,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Send Custom Notification ──────────────────────────
const sendCustomNotification = async (req, res) => {
    const { user, subject, message, emailHtml } = req.body;

    if (!user || !message) {
        return res.status(400).json({
            success: false,
            message: 'user and message are required'
        });
    }

    try {
        const results = {};

        if (user.email && subject) {
            results.email = await sendEmail({
                to: user.email,
                subject,
                html: emailHtml || `<p>${message}</p>`,
            });
        }

        if (user.phone) {
            results.sms = await sendSMS({
                to: user.phone,
                message,
            });
        }

        const io = req.app.get('io');
        if (io && user.id) {
            io.to(`user_${user.id}`).emit('notification', {
                type: 'custom',
                message,
                timestamp: new Date(),
            });
            results.socket = true;
        }

        res.json({ success: true, message: 'Custom notification sent', results });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    sendOrderNotification,
    sendPaymentNotification,
    sendCustomNotification,
};
