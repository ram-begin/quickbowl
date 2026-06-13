require('dotenv').config();

module.exports = {
    port: process.env.PORT || 8004,

    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },

    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phone: process.env.TWILIO_PHONE,
    },

    services: {
        orderService: process.env.ORDER_SERVICE_URL,
        userService: process.env.USER_SERVICE_URL,
    },

    appName: process.env.APP_NAME || 'QuickBowl',
};