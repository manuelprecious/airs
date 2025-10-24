// Add to backend/routes/health.js or create new routes/status.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

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
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

async function getWatchmanStatus() {
  try {
    // Try to connect to watchman service on port 5001 (or wherever it runs)
    const response = await axios.get('http://localhost:5001/status', { timeout: 5000 });
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
    // Use the same test as ChatInterface
    const response = await axios.post(
      'http://127.0.0.1:7860/api/v1/run/6054595b-9a4f-4f84-89ca-4f602cac0bff',
      {
        output_type: "chat",
        input_type: "chat", 
        input_value: "test",
        session_id: "status-check"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-4QAXZM7ZVzIUtEq3gO4KmHiwUvgvlMPxTPLP1wcFZEk',
          'x-api-key': 'sk-4QAXZM7ZVzIUtEq3gO4KmHiwUvgvlMPxTPLP1wcFZEk'
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
    const response = await axios.get('http://localhost:5001/remediation-stats', { timeout: 5000 });
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