const express = require('express');
const axios = require('axios');
const router = express.Router();
const { WATCHMAN_URL, LANGFLOW_URL } = require('../config/constants');
const { getAllServices } = require('../models/Service');

// ADD THIS: Basic health check endpoint
// In routes/health.js, update the health endpoint:
router.get('/health', (req, res) => {
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
    status: overallStatus,  // ← Now dynamic!
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

// Get comprehensive system status
router.get('/system-status', async (req, res) => {
  try {
    // Get watchman service status
    const watchmanStatus = await getWatchmanStatus();
    
    // Get Langflow status using the built-in health check endpoint
    const langflowStatus = await getLangflowStatus();
    
    // Get remediation stats from watchman if available
    const remediationStats = await getRemediationStats();
    
    res.json({
      watchman: watchmanStatus,
      langflow: langflowStatus,
      remediation: remediationStats,
      overall_status: watchmanStatus.running && langflowStatus.connected ? 'operational' : 'degraded',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

async function getWatchmanStatus() {
  try {
    // Try to connect to watchman service
    const response = await axios.get(`${WATCHMAN_URL}/status`, { timeout: 5000 });
    return {
      running: true,
      ...response.data
    };
  } catch (error) {
    return {
      running: false,
      lastHeartbeat: null,
      error: error.message
    };
  }
}

async function getLangflowStatus() {
  try {
    // Use Langflow's built-in health check endpoint (no API key required)
    const response = await axios.get(`${LANGFLOW_URL}/health_check`, {
      headers: {
        'accept': 'application/json'
      },
      timeout: 10000
    });

    return {
      connected: response.data.status === 'ok',
      health_status: response.data,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      lastChecked: new Date().toISOString()
    };
  }
}

async function getRemediationStats() {
  try {
    const response = await axios.get(`${WATCHMAN_URL}/remediation-stats`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    // Return default stats if watchman is unavailable
    return {
      total_fixes: 0,
      success_rate: "0%",
      active_remediations: 0,
      system_load: "Unknown"
    };
  }
}

module.exports = router;