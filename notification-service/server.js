const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const notificationRoutes = require('./src/routes/notificationRoutes');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

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

// Make io accessible in controllers
app.set('io', io);

// Socket.io connection
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// Routes
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'notification-service',
        status: 'running',
        port: process.env.PORT || 8004
    });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8004;
server.listen(PORT, () => {
    console.log(`✅ Notification Service running on port ${PORT}`);
});