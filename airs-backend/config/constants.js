// Thresholds for alerts
const THRESHOLDS = {
  cpu: { warn: 70, crit: 85 },
  memory: { warn: 75, crit: 90 },
  latency: { warn: 300, crit: 500 },
  error_rate: { warn: 5, crit: 10 }
};

// Error patterns for log analysis
const ERROR_PATTERNS = {
  high_cpu: [
    "CPU utilization exceeding thresholds",
    "Garbage collection overhead", 
    "Thread pool exhaustion",
    "High computational load detected"
  ],
  memory_leak: [
    "OutOfMemoryError",
    "GC overhead limit exceeded",
    "Heap space exhausted",
    "Memory allocation failure"
  ],
  database_issues: [
    "Connection pool exhausted",
    "Database timeout", 
    "Deadlock detected",
    "Query execution timeout",
    "Transaction rollback"
  ],
  network_issues: [
    "Connection refused",
    "Gateway timeout",
    "Network latency spike",
    "DNS resolution failed"
  ]
};

// Remediation configurations
const REMEDIATION_CONFIG = {
  restart_service: { time: 4000, successProbability: 0.9 },
  scale_instances: { time: 6000, successProbability: 0.8 },
  scale_memory: { time: 5000, successProbability: 0.85 },
  clear_cache: { time: 3000, successProbability: 0.7 },
  kill_connections: { time: 3500, successProbability: 0.75 }
};

// Load simulation intensities
const LOAD_INTENSITIES = {
  low: 1.5,
  medium: 2.5,
  high: 4.0,
  extreme: 6.0
};

module.exports = {
  THRESHOLDS,
  ERROR_PATTERNS,
  REMEDIATION_CONFIG,
  LOAD_INTENSITIES
};