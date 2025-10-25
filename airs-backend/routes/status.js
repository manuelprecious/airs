const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

const { WATCHMAN_URL, LANGFLOW_URL } = require('../config/constants');


// Cache for Langflow status to avoid frequent checks
let langflowStatusCache = {
  connected: false,
  lastChecked: null,
  error: null
};
const CACHE_DURATION = 30000; // 30 seconds

// Get comprehensive system status
router.get('/system-status', async (req, res) => {
  try {
    // Get watchman service status
    const watchmanStatus = await getWatchmanStatus();

    // Get Langflow status with caching
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
    console.error('System status error:', error);
    res.status(500).json({
      error: 'Failed to get system status',
      details: error.message
    });
  }
});

async function getWatchmanStatus() {
  try {
    // Try to connect to watchman service on port 5001
    const response = await axios.get(`${WATCHMAN_URL}/status`, { timeout: 5000 });
    return {
      running: true,
      ...response.data
    };
  } catch (error) {
    return {
      running: false,
      lastHeartbeat: null,
      error: error.message,
      uptime: 0
    };
  }
}

async function getLangflowStatus() {
  // Return cached result if it's recent enough
  if (langflowStatusCache.lastChecked &&
    (Date.now() - new Date(langflowStatusCache.lastChecked).getTime()) < CACHE_DURATION) {
    return langflowStatusCache;
  }

  try {
    // Use the CORRECT health check endpoint - much lighter than running a flow
    const response = await axios.get(`${LANGFLOW_URL}/health`, {
      timeout: 5000 // 5 second timeout for health check
    });

    const isConnected = response.status === 200;

    // Update cache
    langflowStatusCache = {
      connected: isConnected,
      lastChecked: new Date().toISOString(),
      error: null
    };

    return langflowStatusCache;
  } catch (error) {
    // If /health fails, try the health_check endpoint (some Langflow versions)
    try {
      const fallbackResponse = await axios.get(`${LANGFLOW_URL}/health_check`, {
        timeout: 5000
      });

      const isConnected = fallbackResponse.status === 200;

      langflowStatusCache = {
        connected: isConnected,
        lastChecked: new Date().toISOString(),
        error: null
      };

      return langflowStatusCache;
    } catch (fallbackError) {
      // Both health checks failed
      langflowStatusCache = {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: `Health check failed: ${error.message}`
      };

      return langflowStatusCache;
    }
  }
}

async function getRemediationStats() {
  try {
    const response = await axios.get(`${WATCHMAN_URL}/remediation-stats`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    // Return REAL default stats if watchman is unavailable - all zeros
    return {
      total_fixes: 0,
      success_rate: "0%",
      active_remediations: 0,
      system_load: "Unknown",
      total_attempts: 0,
      failed_remediations: 0
    };
  }
}

// Health check for status service itself
router.get('/status-health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'system-status',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;