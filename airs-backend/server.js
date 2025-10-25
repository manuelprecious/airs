const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const serviceRoutes = require('./routes/services');
const healthRoutes = require('./routes/health');
const statusRoutes = require('./routes/status'); // NEW: Import status routes
const { initializeServices } = require('./models/Service');
const { startMetricsSimulation } = require('./services/metricsService');
const aiProxyRoutes = require('./routes/aiProxy');

const app = express();
const PORT = process.env.PORT || 5000;

const CORS_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${PORT}`;


// Middleware
app.use(helmet());
app.use(cors({
  origin: CORS_ORIGINS,
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
app.use('/api', aiProxyRoutes);


// Add this route to check environment variables
app.get('/api/debug-env', (req, res) => {
  res.json({
    WATCHMAN_URL: process.env.WATCHMAN_URL,
    LANGFLOW_URL: process.env.LANGFLOW_URL,
    WATCHMAN_BASE_URL: process.env.WATCHMAN_BASE_URL,
    LANGFLOW_BASE_URL: process.env.LANGFLOW_BASE_URL,
    allEnvKeys: Object.keys(process.env).filter(key =>
      key.includes('WATCHMAN') || key.includes('LANGFLOW')
    )
  });
});

// Add these debug routes to your main server file

// Check backend configuration
app.get('/api/ai/config-check', (req, res) => {
  res.json({
    LANGFLOW_BASE_URL: process.env.LANGFLOW_URL,
    LANGFLOW_FLOW_ID: process.env.LANGFLOW_FLOW_ID,
    LANGFLOW_API_KEY: process.env.LANGFLOW_API_KEY ? '***' + process.env.LANGFLOW_API_KEY.slice(-4) : 'NOT SET',
    testUrl: `${process.env.LANGFLOW_BASE_URL}/api/v1/run/${process.env.LANGFLOW_FLOW_ID}`
  });
});

// Test the actual Langflow connection
app.get('/api/ai/test-langflow', async (req, res) => {
  try {
    const LANGFLOW_BASE_URL = process.env.LANGFLOW_URL;
    const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID;
    const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
    
    console.log('Testing Langflow connection to:', `${LANGFLOW_BASE_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`);
    
    const response = await fetch(
      `${LANGFLOW_BASE_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LANGFLOW_API_KEY}`,
        },
        body: JSON.stringify({
          output_type: "chat",
          input_type: "chat",
          input_value: "test message",
          session_id: "test-session"
        }),
        timeout: 10000
      }
    );
    
    const data = await response.json();
    
    res.json({
      success: true,
      status: response.status,
      data: data
    });
  } catch (error) {
    console.error('Langflow test error:', error.message);
    res.json({
      success: false,
      error: error.message,
      status: error.response?.status
    });
  }
});

// Add this temporary debug endpoint
app.get('/api/debug-health', (req, res) => {
  const { getAllServices } = require('./models/Service');
  const services = getAllServices();
  
  console.log('=== DEBUG HEALTH ===');
  console.log('All services:', services.map(s => ({ id: s.id, status: s.status })));
  console.log('Critical count:', services.filter(s => s.status === 'critical').length);
  
  res.json({
    all_services: services.map(s => ({ id: s.id, status: s.status })),
    critical_count: services.filter(s => s.status === 'critical').length,
    healthy_count: services.filter(s => s.status === 'healthy').length,
    warning_count: services.filter(s => s.status === 'warning').length,
    calculated_status: services.filter(s => s.status === 'critical').length > 0 ? 'degraded' : 'healthy'
  });
});


// ADD THIS: Basic health check endpoint
// Replace the existing /api/health endpoint with this:
app.get('/api/health', (req, res) => {
  const { getAllServices } = require('./models/Service');
  const services = getAllServices();
  const servicesTotal = services.length;
  const servicesHealthy = services.filter(s => s.status === 'healthy').length;
  const servicesCritical = services.filter(s => s.status === 'critical').length;
  const servicesWarning = services.filter(s => s.status === 'warning').length;
  
  // Determine actual status based on service health
  let overallStatus = 'healthy';
  if (servicesCritical > 0) {
    overallStatus = 'degraded';
  } else if (servicesWarning > 0) {
    overallStatus = 'warning';
  }
  
  res.json({
    status: overallStatus,  // ← Now dynamic based on service health
    message: 'SRE Monitoring Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    services_total: servicesTotal,
    services_healthy: servicesHealthy,
    services_critical: servicesCritical,
    services_warning: servicesWarning
  });
});

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
  console.log(`📊 Health check available at ${SERVER_BASE_URL}/api/health`);
  console.log(`🤖 System status available at ${SERVER_BASE_URL}/api/system-status`);

  // Start metrics simulation
  startMetricsSimulation();
});

module.exports = app;