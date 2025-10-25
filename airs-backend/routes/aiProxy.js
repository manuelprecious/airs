const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

const LANGFLOW_API_KEY = process.env.LANGFLOW_API_KEY;
const LANGFLOW_BASE_URL = process.env.LANGFLOW_URL || 'http://localhost:7860';
const LANGFLOW_FLOW_ID = process.env.LANGFLOW_FLOW_ID;

// Response extraction
function extractLangflowResponse(data) {
  console.log('🔍 Attempting to extract Langflow response from:', JSON.stringify(data, null, 2));
  
  try {
    // Strategy 1: Deep nested structure (most common)
    if (data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text) {
      console.log('✅ Found response in: outputs[0].outputs[0].results.message.text');
      return data.outputs[0].outputs[0].results.message.text;
    }
    
    // Strategy 2: Direct message in results
    if (data?.outputs?.[0]?.outputs?.[0]?.results?.message) {
      const message = data.outputs[0].outputs[0].results.message;
      console.log('✅ Found response in: outputs[0].outputs[0].results.message');
      return typeof message === 'string' ? message : JSON.stringify(message);
    }
    
    // Strategy 3: Output field
    if (data?.outputs?.[0]?.outputs?.[0]?.results?.output) {
      console.log('✅ Found response in: outputs[0].outputs[0].results.output');
      return data.outputs[0].outputs[0].results.output;
    }
    
    // Strategy 4: Direct outputs text
    if (data?.outputs?.[0]?.outputs?.[0]?.text) {
      console.log('✅ Found response in: outputs[0].outputs[0].text');
      return data.outputs[0].outputs[0].text;
    }
    
    // Strategy 5: Root level message
    if (data?.message) {
      console.log('✅ Found response in: message');
      return data.message;
    }
    
    // Strategy 6: Root level output
    if (data?.output) {
      console.log('✅ Found response in: output');
      return data.output;
    }
    
    // Strategy 7: If outputs exists but we couldn't parse it, stringify the first output
    if (data?.outputs?.[0]) {
      console.log('🔄 Attempting to stringify first output');
      const firstOutput = data.outputs[0];
      return typeof firstOutput === 'string' ? firstOutput : JSON.stringify(firstOutput, null, 2);
    }
    
    // Strategy 8: Last resort - stringify the entire response
    console.log('🔄 Stringifying entire response as last resort');
    return JSON.stringify(data, null, 2);
    
  } catch (error) {
    console.error('❌ Error in extractLangflowResponse:', error);
    return "I received your message but encountered an error processing the Langflow response.";
  }
}

// Proxy for Langflow chat messages - 3 MINUTE TIMEOUT
router.post('/ai/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: 'Message is required',
        statusCode: 400
      });
    }

    const payload = {
      output_type: "chat",
      input_type: "chat", 
      input_value: message,
      session_id: sessionId || `session-${Date.now()}`
    };

    console.log('🔄 Proxying to Langflow:', { 
      url: `${LANGFLOW_BASE_URL}/api/v1/run/${LANGFLOW_FLOW_ID}?stream=false`,
      sessionId: payload.session_id,
      messageLength: message.length,
      hasApiKey: !!LANGFLOW_API_KEY,
      timeout: '180000ms (3 minutes)'
    });

    // Prepare headers - INCLUDE API KEY if available
    const headers = {
      'Content-Type': 'application/json'
    };

    // ADD API KEY TO HEADERS if it exists
    if (LANGFLOW_API_KEY) {
      headers['Authorization'] = `Bearer ${LANGFLOW_API_KEY}`;
      console.log('🔑 Using API key for Langflow authentication');
    } else {
      console.log('⚠️ No API key found - Langflow may require authentication');
    }

    const response = await axios.post(
      `${LANGFLOW_BASE_URL}/api/v1/run/${LANGFLOW_FLOW_ID}?stream=false`,
      payload,
      {
        headers: headers,
        timeout: 180000 // 3 MINUTES (180 seconds)
      }
    );

    console.log('✅ Langflow raw response received');
    
    const aiResponse = extractLangflowResponse(response.data);
    
    console.log('📝 Extracted response:', aiResponse?.substring(0, 200) + (aiResponse?.length > 200 ? '...' : ''));

    res.json({
      success: true,
      message: aiResponse,
      source: 'langflow',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Langflow proxy error:', error.response?.data || error.message);
    
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.response) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.detail || error.response.statusText || error.message;
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Cannot connect to Langflow server';
    } else if (error.code === 'ETIMEDOUT') {
      statusCode = 504;
      errorMessage = 'Request timeout - Langflow is taking too long to respond (over 3 minutes)';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      statusCode: statusCode,
      details: error.response?.data || null
    });
  }
});

// Status check - 10 seconds is fine for health check
router.get('/ai/status', async (req, res) => {
  try {
    const headers = {};
    
    // Include API key for status check too if available
    if (LANGFLOW_API_KEY) {
      headers['Authorization'] = `Bearer ${LANGFLOW_API_KEY}`;
    }

    const response = await axios.get(
      `${LANGFLOW_BASE_URL}/health_check`,
      {
        headers: headers,
        timeout: 10000 // 10 seconds for health check
      }
    );

    if (response.data && response.data.status === 'ok') {
      res.json({
        connected: true,
        status: 'operational',
        lastChecked: new Date().toISOString()
      });
    } else {
      res.json({
        connected: false,
        status: 'unavailable',
        lastChecked: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Langflow health check failed:', error.message);
    
    res.json({
      connected: false,
      status: 'unavailable',
      lastChecked: new Date().toISOString()
    });
  }
});

// Config endpoint
router.get('/ai/config', (req, res) => {
  res.json({
    langflowUrl: LANGFLOW_BASE_URL,
    flowId: LANGFLOW_FLOW_ID,
    hasApiKey: !!LANGFLOW_API_KEY,
    apiKeyConfigured: LANGFLOW_API_KEY ? true : false
  });
});

// Debug endpoint to test Langflow connection - 3 MINUTE TIMEOUT
router.get('/ai/test-langflow', async (req, res) => {
  try {
    console.log('Testing Langflow connection to:', `${LANGFLOW_BASE_URL}/api/v1/run/${LANGFLOW_FLOW_ID}?stream=false`);
    console.log('⏰ Using 3-minute timeout for complex flows...');
    
    // Prepare headers - INCLUDE API KEY
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (LANGFLOW_API_KEY) {
      headers['Authorization'] = `Bearer ${LANGFLOW_API_KEY}`;
    }

    const response = await axios.post(
      `${LANGFLOW_BASE_URL}/api/v1/run/${LANGFLOW_FLOW_ID}?stream=false`,
      {
        output_type: "chat",
        input_type: "chat",
        input_value: "test message",
        session_id: "test-session"
      },
      {
        headers: headers,
        timeout: 180000 // 3 MINUTES (180 seconds)
      }
    );
    
    res.json({
      success: true,
      status: response.status,
      data: response.data
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

// Simple connectivity test (no flow execution) - 10 seconds is fine
router.get('/ai/connectivity-test', async (req, res) => {
  try {
    console.log('Testing basic connectivity to Langflow...');
    
    const headers = {};
    if (LANGFLOW_API_KEY) {
      headers['Authorization'] = `Bearer ${LANGFLOW_API_KEY}`;
    }

    const response = await axios.get(
      `${LANGFLOW_BASE_URL}/health_check`,
      {
        headers: headers,
        timeout: 10000
      }
    );

    res.json({
      success: true,
      status: response.status,
      data: response.data,
      message: 'Langflow is reachable and responding'
    });
  } catch (error) {
    console.error('Connectivity test failed:', error.message);
    res.json({
      success: false,
      error: error.message,
      message: 'Cannot connect to Langflow server'
    });
  }
});

// Config check endpoint
router.get('/ai/config-check', (req, res) => {
  res.json({
    LANGFLOW_BASE_URL: LANGFLOW_BASE_URL,
    LANGFLOW_FLOW_ID: LANGFLOW_FLOW_ID,
    LANGFLOW_API_KEY: LANGFLOW_API_KEY ? '***' + LANGFLOW_API_KEY.slice(-4) : 'NOT SET',
    testUrl: `${LANGFLOW_BASE_URL}/api/v1/run/${LANGFLOW_FLOW_ID}?stream=false`,
    hasApiKey: !!LANGFLOW_API_KEY
  });
});

module.exports = router;