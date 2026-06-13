require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,

    services: {
        user: process.env.USER_SERVICE_URL,
        restaurant: process.env.RESTAURANT_SERVICE_URL,
        order: process.env.ORDER_SERVICE_URL,
        payment: process.env.PAYMENT_SERVICE_URL,
        notification: process.env.NOTIFICATION_SERVICE_URL,
    },

    jwt: {
        secret: process.env.JWT_SECRET,
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    },
};