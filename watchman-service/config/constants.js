require('dotenv').config(); // Load environment variables

module.exports = {
  // Backend API configuration
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:5000",
  
  // Watchman service configuration
  WATCHMAN_URL: process.env.WATCHMAN_URL || "http://localhost:5001",
  
  // Langflow AI configuration
  LANGFLOW_URL: process.env.LANGFLOW_URL || "http://localhost:7860",
  LANGFLOW_API_KEY: process.env.LANGFLOW_API_KEY,
  LANGFLOW_HEALTH_FLOW_ID: process.env.LANGFLOW_HEALTH_FLOW_ID,
  LANGFLOW_REMEDIATION_FLOW_ID: process.env.LANGFLOW_REMEDIATION_FLOW_ID,

  // Token Management Limits
  TOKEN_LIMITS: {
    DAILY: parseInt(process.env.DAILY_TOKEN_LIMIT) || 500000,
    MINUTE: parseInt(process.env.MINUTE_TOKEN_LIMIT) || 6000,
    DAILY_REQUESTS: parseInt(process.env.DAILY_REQUEST_LIMIT) || 20000,
    MINUTE_REQUESTS: parseInt(process.env.MINUTE_REQUEST_LIMIT) || 200
  },

  // Polling intervals (in seconds)
  POLLING_INTERVALS: {
    NORMAL: parseInt(process.env.NORMAL_POLLING_INTERVAL) || 30,
    DEGRADED: parseInt(process.env.DEGRADED_POLLING_INTERVAL) || 15,
    CRITICAL: parseInt(process.env.CRITICAL_POLLING_INTERVAL) || 10,
  },

  // Service states
  STATES: {
    HEALTHY: "healthy",
    WARNING: "warning",
    CRITICAL: "critical",
  },

  // Remediation actions
  ACTIONS: {
    RESTART_SERVICE: "restart_service",
    SCALE_INSTANCES: "scale_instances",
    SCALE_MEMORY: "scale_memory",
    CLEAR_CACHE: "clear_cache",
    KILL_CONNECTIONS: "kill_connections",
  },

  // HTTP request timeouts (in milliseconds)
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 10000,
  LANGFLOW_TIMEOUT: parseInt(process.env.LANGFLOW_TIMEOUT) || 180000,

  // Environment
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info"
};