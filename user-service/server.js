const { metricsMiddleware, metricsEndpoint } = require('./src/telemetry');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');
require('dotenv').config();
const authRoutes        = require('./src/routes/auth');
const { createUsersTable } = require('./src/models/user');

const app = express();

// Security & Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin:         '*',
  methods:        ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// API Routes — must be before static files
app.use('/api/auth', authRoutes);

// Serve Frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    success:   true,
    service:   'user-service',
    status:    'running',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend for all other routes
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start Server
const PORT = process.env.PORT || 3001;
const startServer = async () => {
  try {
    await createUsersTable();
    app.listen(PORT, () => {
      console.log(`🚀 User Service running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
};
startServer();