const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const serviceRoutes = require('./routes/services');
const healthRoutes = require('./routes/health');
const statusRoutes = require('./routes/status'); // NEW: Import status routes
const { initializeServices } = require('./models/Service');
const { startMetricsSimulation } = require('./services/metricsService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Allow frontend origins
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// Initialize services data
initializeServices();

// Routes
app.use('/api', serviceRoutes);
app.use('/api', healthRoutes);
app.use('/api', statusRoutes); // NEW: Add status routes

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SRE Monitoring Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      services: '/api/services',
      system_status: '/api/system-status'
    }
  });
});

// FIXED: 404 handler - removed the problematic wildcard route
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 SRE Monitoring Backend running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/api/health`);
  console.log(`🤖 System status available at http://localhost:${PORT}/api/system-status`);
  
  // Start metrics simulation
  startMetricsSimulation();
});

module.exports = app;