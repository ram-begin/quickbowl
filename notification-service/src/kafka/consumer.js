const { Kafka } = require('kafkajs');
const { sendEmail, templates } = require('../services/emailService');
const { sendSMS, smsTemplates } = require('../services/smsService');

const kafka = new Kafka({
    clientId: 'notification-service',
    brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

const handleOrderEvent = async (topic, message, io) => {
    const payload = JSON.parse(message.value.toString());
    const { type, user, orderDetails } = payload;

    console.log(`📨 Kafka event received: ${topic}`, { type, userId: user?.id });

    const results = {};

    if (user?.email) {
        const template = templates[type] ? templates[type](orderDetails) : null;
        if (template) {
            results.email = await sendEmail({ to: user.email, subject: template.subject, html: template.html });
        }
    }

    if (user?.phone) {
        const smsText = smsTemplates[type] ? smsTemplates[type](orderDetails) : null;
        if (smsText) {
            results.sms = await sendSMS({ to: user.phone, message: smsText });
        }
    }

    if (io && user?.id) {
        io.to(`user_${user.id}`).emit('notification', { type, orderDetails, timestamp: new Date() });
        results.socket = true;
    }

    return results;
};

const handlePaymentEvent = async (topic, message, io) => {
    const payload = JSON.parse(message.value.toString());
    const { type, user, paymentDetails } = payload;

    console.log(`💳 Kafka event received: ${topic}`, { type, userId: user?.id });

    const results = {};

    if (user?.email) {
        const template = templates[type] ? templates[type](paymentDetails) : null;
        if (template) {
            results.email = await sendEmail({ to: user.email, subject: template.subject, html: template.html });
        }
    }

    if (user?.phone) {
        const smsText = smsTemplates[type] ? smsTemplates[type](paymentDetails) : null;
        if (smsText) {
            results.sms = await sendSMS({ to: user.phone, message: smsText });
        }
    }

    if (io && user?.id) {
        io.to(`user_${user.id}`).emit('notification', { type, paymentDetails, timestamp: new Date() });
        results.socket = true;
    }

    return results;
};

const startConsumer = async (io) => {
    await consumer.connect();
    console.log('✅ Kafka consumer connected');

    await consumer.subscribe({
        topics: ['order.placed', 'order.status.updated', 'payment.completed', 'payment.refunded'],
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            try {
                if (topic.startsWith('order.')) {
                    await handleOrderEvent(topic, message, io);
                } else if (topic.startsWith('payment.')) {
                    await handlePaymentEvent(topic, message, io);
                }
            } catch (err) {
                console.error(`❌ Error processing Kafka message from ${topic}:`, err.message);
            }
        },
    });
};

const stopConsumer = async () => {
    await consumer.disconnect();
    console.log('🔌 Kafka consumer disconnected');
};

module.exports = { startConsumer, stopConsumer };