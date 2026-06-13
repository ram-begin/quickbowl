const { Kafka } = require('kafkajs');

const kafka = new Kafka({
    clientId: 'payment-service',
    brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

const producer = kafka.producer();
let connected = false;

const connect = async () => {
    if (!connected) {
        await producer.connect();
        connected = true;
        console.log('✅ Kafka producer connected (payment-service)');
    }
};

const publishPaymentEvent = async (topic, payload) => {
    try {
        await connect();
        await producer.send({
            topic,
            messages: [{ value: JSON.stringify(payload) }],
        });
        console.log(`📤 Published to ${topic}`, { userId: payload.user?.id });
    } catch (err) {
        console.error(`❌ Failed to publish to ${topic}:`, err.message);
    }
};

module.exports = { publishPaymentEvent };