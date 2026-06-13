const { metricsMiddleware, metricsEndpoint } = require('./src/telemetry');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const paymentRoutes = require('./src/routes/paymentRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { initDB } = require('./src/config/db');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Routes
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'payment-service',
        status: 'running',
        port: process.env.PORT || 8003
    });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8003;
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`✅ Payment Service running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});