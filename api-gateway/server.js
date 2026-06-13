const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const routes = require('./src/routes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const rateLimiter = require('./src/middleware/rateLimiter');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(rateLimiter);

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'api-gateway',
        status: 'running',
        port: process.env.PORT || 3000,
        services: {
            users: process.env.USER_SERVICE_URL,
            restaurants: process.env.RESTAURANT_SERVICE_URL,
            orders: process.env.ORDER_SERVICE_URL,
            payments: process.env.PAYMENT_SERVICE_URL,
            notifications: process.env.NOTIFICATION_SERVICE_URL,
        }
    });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API Gateway running on port ${PORT}`);
});