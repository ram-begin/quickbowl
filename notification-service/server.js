const { metricsMiddleware, metricsEndpoint } = require('./src/telemetry');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const notificationRoutes = require('./src/routes/notificationRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { startConsumer, stopConsumer } = require('./src/kafka/consumer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(metricsMiddleware);

// Make io accessible in controllers
app.set('io', io);

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Routes
app.use('/api/notifications', notificationRoutes);

// Socket.io connection
io.on('connection', (socket) => {
    console.log(`📌 Client connected: ${socket.id}`);
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined their room`);
    });
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ success: true, service: 'notification-service', status: 'running' });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8004;
server.listen(PORT, async () => {
    console.log(`🔔 Notification service running on port ${PORT}`);
    try {
        await startConsumer(io);
    } catch (err) {
        console.error('⚠️  Kafka consumer failed to start (running without Kafka):', err.message);
    }
});

process.on('SIGTERM', async () => {
    await stopConsumer();
    process.exit(0);
});