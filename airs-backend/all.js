const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// In-memory storage for services state
let services = [
  {
    id: 'S1',
    name: 'Payment Gateway',
    status: 'critical', // Start critical to immediately trigger agent
    metrics: {
      cpu: 92.0,
      memory: 85.0,
      latency: 1200,
      error_rate: 15.5,
      throughput: 150
    },
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: 'CPU utilization critically high - service degraded',
        trace_id: 'trace-001'
      },
      {
        timestamp: new Date().toISOString(),
        level: 'WARN', 
        message: 'Database connection pool exhausted',
        trace_id: 'trace-002'
      }
    ],
    remediationInProgress: false,
    lastIncident: null,
    instanceCount: 2,
    // NEW: Track the degraded state metrics
    degradedMetrics: null,
    // NEW: Track if service is waiting for remediation
    awaitingRemediation: true
  },
  {
    id: 'S2',
    name: 'User Auth API',
    status: 'healthy',
    metrics: {
      cpu: 30.0,
      memory: 60.0,
      latency: 80,
      error_rate: 1.2,
      throughput: 800
    },
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Authentication service running',
        trace_id: 'trace-003'
      }
    ],
    remediationInProgress: false,
    lastIncident: null,
    instanceCount: 3,
    degradedMetrics: null,
    awaitingRemediation: false
  },
  // ... other services (S3-S6) follow similar pattern
  {
    id: 'S3',
    name: 'Inventory Service', 
    status: 'warning',
    metrics: {
      cpu: 75.0,
      memory: 65.0,
      latency: 450,
      error_rate: 8.1,
      throughput: 350
    },
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: 'High latency detected',
        trace_id: 'trace-004'
      }
    ],
    remediationInProgress: false,
    lastIncident: null,
    instanceCount: 2,
    degradedMetrics: null,
    awaitingRemediation: false
  }
];

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

// Utility functions
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function addLogEntry(service, level, message) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    trace_id: `trace-${Date.now()}${getRandomInt(100, 999)}`
  };
  
  service.logs.unshift(logEntry);
  // Keep only last 50 logs
  if (service.logs.length > 50) {
    service.logs = service.logs.slice(0, 50);
  }
  
  return logEntry;
}

function analyzeLogs(service) {
  const recentErrors = service.logs
    .filter(log => log.level === 'ERROR' || log.level === 'WARN')
    .slice(0, 10)
    .map(log => log.message);

  const patterns = [];
  let suggestedActions = [];
  let rootCause = 'unknown';

  // Analyze error patterns
  if (recentErrors.some(error => 
    error.includes('CPU') || error.includes('thread') || error.includes('computational'))) {
    patterns.push('high_cpu_usage');
    suggestedActions.push('scale_instances', 'restart_service');
    rootCause = 'high_cpu_load';
  }

  if (recentErrors.some(error => 
    error.includes('memory') || error.includes('Memory') || error.includes('heap') || error.includes('GC'))) {
    patterns.push('memory_leak');
    suggestedActions.push('restart_service', 'scale_memory');
    rootCause = 'memory_exhaustion';
  }

  if (recentErrors.some(error => 
    error.includes('database') || error.includes('Database') || error.includes('connection') || error.includes('transaction'))) {
    patterns.push('database_connection_issues');
    suggestedActions.push('restart_service', 'kill_connections');
    rootCause = 'database_bottleneck';
  }

  if (recentErrors.some(error => 
    error.includes('timeout') || error.includes('latency') || error.includes('Network'))) {
    patterns.push('high_latency');
    suggestedActions.push('scale_instances', 'clear_cache');
    rootCause = 'network_latency';
  }

  // Default actions if no specific patterns
  if (suggestedActions.length === 0) {
    suggestedActions = ['restart_service', 'scale_instances'];
    rootCause = 'general_performance_issue';
  }

  return {
    recent_errors: recentErrors,
    patterns: [...new Set(patterns)],
    suggested_actions: [...new Set(suggestedActions)],
    root_cause: rootCause,
    analysis_timestamp: new Date().toISOString()
  };
}

function updateServiceMetrics() {
  services.forEach(service => {
    // CRITICAL FIX: Only update metrics if service is healthy or warning
    // If service is critical and awaiting remediation, DO NOT update metrics
    if ((service.status === 'critical' && service.awaitingRemediation) || service.remediationInProgress) {
      return; // Service stays in degraded state until remediated
    }

    // For healthy/warning services, allow natural fluctuations
    const fluctuation = getRandomFloat(-5, 5);
    
    service.metrics.cpu = Math.max(1, service.metrics.cpu + fluctuation);
    service.metrics.memory = Math.max(10, service.metrics.memory + fluctuation);
    service.metrics.latency = Math.max(10, service.metrics.latency + getRandomInt(-10, 10));
    service.metrics.error_rate = Math.max(0, service.metrics.error_rate + getRandomFloat(-0.5, 0.5));
    service.metrics.throughput = Math.max(100, service.metrics.throughput + getRandomInt(-50, 50));

    // Check if service should transition to critical/warning
    let newStatus = 'healthy';
    
    if (service.metrics.cpu >= THRESHOLDS.cpu.crit || 
        service.metrics.memory >= THRESHOLDS.memory.crit ||
        service.metrics.latency >= THRESHOLDS.latency.crit ||
        service.metrics.error_rate >= THRESHOLDS.error_rate.crit) {
      newStatus = 'critical';
    } else if (service.metrics.cpu >= THRESHOLDS.cpu.warn || 
               service.metrics.memory >= THRESHOLDS.memory.warn ||
               service.metrics.latency >= THRESHOLDS.latency.warn ||
               service.metrics.error_rate >= THRESHOLDS.error_rate.warn) {
      newStatus = 'warning';
    }

    // Handle status transitions
    if (service.status !== newStatus) {
      if (newStatus === 'critical') {
        // Service just became critical - freeze its state and await remediation
        service.awaitingRemediation = true;
        service.degradedMetrics = {...service.metrics}; // Save the degraded state
        addLogEntry(service, 'ERROR', `Service entered CRITICAL state - awaiting remediation`);
      } else if (newStatus === 'warning' && service.status === 'healthy') {
        addLogEntry(service, 'WARN', `Service entered WARNING state`);
      } else if (newStatus === 'healthy' && service.status !== 'healthy') {
        addLogEntry(service, 'INFO', `Service returned to HEALTHY state`);
        service.awaitingRemediation = false;
        service.degradedMetrics = null;
      }
      
      service.status = newStatus;
    }

    // Occasionally generate warnings/errors for healthy services
    if (service.status === 'healthy' && Math.random() < 0.1) {
      const errorTypes = Object.keys(ERROR_PATTERNS);
      const randomErrorType = errorTypes[getRandomInt(0, errorTypes.length - 1)];
      const randomError = ERROR_PATTERNS[randomErrorType][getRandomInt(0, ERROR_PATTERNS[randomErrorType].length - 1)];
      
      addLogEntry(service, 'WARN', randomError);
    }

    // Add some INFO logs occasionally
    if (Math.random() < 0.05) {
      const infoMessages = [
        'Request processed successfully',
        'Cache hit ratio normal',
        'Database connection stable',
        'Health check passed',
        'Metrics collected'
      ];
      addLogEntry(service, 'INFO', infoMessages[getRandomInt(0, infoMessages.length - 1)]);
    }
  });
}

// Routes

// Get all services overview
app.get('/api/services', (req, res) => {
  const overview = services.map(service => ({
    id: service.id,
    name: service.name,
    status: service.status,
    remediationInProgress: service.remediationInProgress,
    awaitingRemediation: service.awaitingRemediation,
    instanceCount: service.instanceCount,
    lastIncident: service.lastIncident
  }));
  
  res.json(overview);
});

// Get detailed metrics and logs for a specific service
app.get('/api/services/:id/metrics', (req, res) => {
  const service = services.find(s => s.id === req.params.id);
  
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  res.json({
    id: service.id,
    name: service.name,
    status: service.status,
    metrics: service.metrics,
    logs: service.logs.slice(0, 20),
    remediationInProgress: service.remediationInProgress,
    awaitingRemediation: service.awaitingRemediation,
    instanceCount: service.instanceCount,
    lastIncident: service.lastIncident
  });
});

// Get log analysis for agent decision making
app.get('/api/services/:id/logs/analysis', (req, res) => {
  const service = services.find(s => s.id === req.params.id);
  
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const analysis = analyzeLogs(service);
  res.json(analysis);
});

// Simulate load on a service (to trigger issues)
app.post('/api/services/:id/simulate-load', (req, res) => {
  const service = services.find(s => s.id === req.params.id);
  
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  // Don't allow load simulation on services awaiting remediation
  if (service.awaitingRemediation || service.remediationInProgress) {
    return res.status(409).json({ 
      error: 'Cannot simulate load - service is awaiting remediation or currently being remediated' 
    });
  }

  const { intensity = 'medium' } = req.body;
  const intensityMultipliers = {
    low: 1.5,
    medium: 2.5,
    high: 4.0,
    extreme: 6.0
  };

  const multiplier = intensityMultipliers[intensity] || 2.0;

  // Spike metrics based on intensity
  service.metrics.cpu = Math.min(100, service.metrics.cpu * multiplier);
  service.metrics.memory = Math.min(100, service.metrics.memory * multiplier);
  service.metrics.latency = service.metrics.latency * multiplier;
  service.metrics.error_rate = Math.min(50, service.metrics.error_rate * multiplier);
  service.metrics.throughput = service.metrics.throughput * 0.8;

  addLogEntry(service, 'WARN', `Simulated ${intensity} load applied to service`);
  addLogEntry(service, 'ERROR', `Performance degradation detected under ${intensity} load`);

  // Update status - if critical, freeze the service
  if (service.metrics.cpu >= THRESHOLDS.cpu.crit || service.metrics.error_rate >= THRESHOLDS.error_rate.crit) {
    service.status = 'critical';
    service.awaitingRemediation = true;
    service.degradedMetrics = {...service.metrics};
    addLogEntry(service, 'ERROR', `Service CRITICAL - frozen state awaiting remediation`);
  } else {
    service.status = 'warning';
  }

  res.json({
    message: `Applied ${intensity} load to ${service.name}`,
    current_metrics: service.metrics,
    status: service.status,
    awaiting_remediation: service.awaitingRemediation
  });
});

// Remediate a service (called by agent or manual override)
app.post('/api/services/:id/remediate', (req, res) => {
  const service = services.find(s => s.id === req.params.id);
  
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  // Don't allow remediation if not in critical state or already being remediated
  if (service.status !== 'critical' && !service.awaitingRemediation) {
    return res.status(409).json({ 
      error: 'Service does not require remediation - status is not critical' 
    });
  }

  if (service.remediationInProgress) {
    return res.status(409).json({ error: 'Remediation already in progress' });
  }

  const { action, reason = 'No reason provided' } = req.body;
  
  service.remediationInProgress = true;
  service.awaitingRemediation = false; // No longer awaiting, now in progress
  service.lastIncident = {
    timestamp: new Date().toISOString(),
    action_taken: action,
    reason: reason,
    pre_remediation_metrics: service.degradedMetrics ? {...service.degradedMetrics} : {...service.metrics}
  };

  addLogEntry(service, 'INFO', `Remediation started: ${action} - Reason: ${reason}`);

  // Simulate different remediation outcomes based on action
  let remediationTime;
  let successProbability;

  switch (action) {
    case 'restart_service':
      remediationTime = 4000; // 4 seconds
      successProbability = 0.9;
      addLogEntry(service, 'INFO', 'Initiating service restart...');
      break;
    
    case 'scale_instances':
      remediationTime = 6000; // 6 seconds  
      successProbability = 0.8;
      addLogEntry(service, 'INFO', 'Scaling service instances...');
      break;
    
    case 'scale_memory':
      remediationTime = 5000; // 5 seconds
      successProbability = 0.85;
      addLogEntry(service, 'INFO', 'Allocating additional memory...');
      break;
    
    case 'clear_cache':
      remediationTime = 3000; // 3 seconds
      successProbability = 0.7;
      addLogEntry(service, 'INFO', 'Clearing service cache...');
      break;
    
    case 'kill_connections':
      remediationTime = 3500; // 3.5 seconds
      successProbability = 0.75;
      addLogEntry(service, 'INFO', 'Terminating stale connections...');
      break;
    
    default:
      remediationTime = 4000;
      successProbability = 0.5;
      addLogEntry(service, 'WARN', `Unknown remediation action: ${action}`);
  }

  // Simulate remediation process
  setTimeout(() => {
    const success = Math.random() < successProbability;
    
    if (success) {
      // Reset to healthy state with improved metrics
      service.metrics = {
        cpu: getRandomFloat(15, 35),
        memory: getRandomFloat(40, 60),
        latency: getRandomInt(30, 100),
        error_rate: getRandomFloat(0.1, 2.0),
        throughput: getRandomInt(800, 1500)
      };
      service.status = 'healthy';
      
      if (action === 'scale_instances') {
        service.instanceCount += 1;
        addLogEntry(service, 'INFO', `Service scaled to ${service.instanceCount} instances`);
      }
      
      addLogEntry(service, 'INFO', `Remediation SUCCESS: ${action}. Service restored to healthy state.`);
      service.degradedMetrics = null;
    } else {
      // Remediation failed - service stays critical
      addLogEntry(service, 'ERROR', `Remediation FAILED: ${action}. Service remains in critical state.`);
      
      // Optionally make metrics worse to simulate failure
      if (service.degradedMetrics) {
        service.metrics = {
          ...service.degradedMetrics,
          error_rate: service.degradedMetrics.error_rate + getRandomFloat(5, 15)
        };
      }
      
      service.status = 'critical';
      service.awaitingRemediation = true; // Still awaiting remediation
    }
    
    service.remediationInProgress = false;
    
  }, remediationTime);

  res.json({
    message: `Remediation action '${action}' initiated`,
    estimated_completion: remediationTime,
    service_status: 'remediating',
    action_reason: reason,
    success_probability: successProbability
  });
});

// Get service health check
app.get('/api/health', (req, res) => {
  const healthyServices = services.filter(s => s.status === 'healthy').length;
  const criticalServices = services.filter(s => s.status === 'critical').length;
  const totalServices = services.length;
  
  res.json({
    status: criticalServices > 0 ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    services_healthy: healthyServices,
    services_critical: criticalServices,
    services_total: totalServices,
    uptime: process.uptime()
  });
});

// Reset all services to healthy state (for testing)
app.post('/api/services/reset', (req, res) => {
  services.forEach(service => {
    service.status = 'healthy';
    service.remediationInProgress = false;
    service.awaitingRemediation = false;
    service.metrics = {
      cpu: getRandomFloat(15, 45),
      memory: getRandomFloat(30, 65),
      latency: getRandomInt(20, 150),
      error_rate: getRandomFloat(0.1, 3.0),
      throughput: getRandomInt(500, 1200)
    };
    service.logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Service reset to healthy state',
        trace_id: `reset-${Date.now()}`
      }
    ];
    service.degradedMetrics = null;
  });
  
  res.json({ message: 'All services reset to healthy state' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 SRE Monitoring Backend running on port ${PORT}`);
  console.log(`📊 Monitoring ${services.length} microservices`);
  console.log(`🔗 Health check available at http://localhost:${PORT}/api/health`);
  console.log(`⚠️  Service S1 starts in CRITICAL state to demonstrate agent workflow`);
});

// Update metrics every 5 seconds (only for healthy/warning services)
setInterval(updateServiceMetrics, 5000);