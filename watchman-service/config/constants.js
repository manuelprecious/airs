module.exports = {
  // Backend API configuration
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:5000",

  // Langflow AI configuration
  LANGFLOW_URL: process.env.LANGFLOW_URL || "http://localhost:7860",

  // Polling intervals (in seconds)
  POLLING_INTERVALS: {
    NORMAL: 30,
    DEGRADED: 15,
    CRITICAL: 10,
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

  // HTTP request timeout (in milliseconds)
  REQUEST_TIMEOUT: 10000,
};
