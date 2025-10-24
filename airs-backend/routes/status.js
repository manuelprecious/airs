const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();
const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
const WATCHMAN_BASE_URL = process.env.WATCHMAN_BASE_URL || 'http://localhost:5001';
const LANGFLOW_BASE_URL = process.env.LANGFLOW_BASE_URL || 'http://localhost:7860';
const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID;

// Get comprehensive system status
router.get('/system-status', async (req, res) => {
  try {
    // Get watchman service status
    const watchmanStatus = await getWatchmanStatus();

    // Get Langflow status using the same logic as frontend chat
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
    const response = await axios.get(`${WATCHMAN_BASE_URL}/status`, { timeout: 5000 });
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
  try {
    // Use the same test as ChatInterface - test endpoint for faster response
    const response = await axios.post(
      `${LANGFLOW_BASE_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
      {
        output_type: "chat",
        input_type: "chat",
        input_value: "test",
        session_id: "status-check-" + Date.now()
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LANGFLOW_API_KEY}`,
          'x-api-key': LANGFLOW_API_KEY
        },
        timeout: 10000
      }
    );

    return {
      connected: response.status === 200,
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
    const response = await axios.get(`${WATCHMAN_BASE_URL}/remediation-stats`, { timeout: 5000 });
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