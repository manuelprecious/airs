const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const serviceRoutes = require('./routes/services');
const healthRoutes = require('./routes/health');
const { initializeServices } = require('./models/Service');
const { startMetricsSimulation } = require('./services/metricsService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Initialize services data
initializeServices();

// Routes
app.use('/api', serviceRoutes);
app.use('/api', healthRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 SRE Monitoring Backend running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/api/health`);
  
  // Start metrics simulation
  startMetricsSimulation();
});