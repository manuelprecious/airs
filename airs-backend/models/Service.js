const { getRandomFloat, getRandomInt } = require('../utils/helpers');

class Service {
  constructor(id, name, initialStatus = 'healthy') {
    this.id = id;
    this.name = name;
    this.status = initialStatus;
    this.metrics = {
      cpu: getRandomFloat(15, initialStatus === 'critical' ? 92 : 45),
      memory: getRandomFloat(30, initialStatus === 'critical' ? 85 : 65),
      latency: getRandomInt(20, initialStatus === 'critical' ? 1200 : 150),
      error_rate: getRandomFloat(0.1, initialStatus === 'critical' ? 15.5 : 3.0),
      throughput: getRandomInt(500, initialStatus === 'critical' ? 150 : 1200)
    };
    this.logs = [];
    this.remediationInProgress = false;
    this.awaitingRemediation = initialStatus === 'critical';
    this.instanceCount = getRandomInt(1, 4);
    this.lastIncident = null;
    this.degradedMetrics = initialStatus === 'critical' ? { ...this.metrics } : null;

    // Add initial log
    this.addLog('INFO', `${name} ${initialStatus === 'critical' ? 'started in CRITICAL state' : 'started successfully'}`);
  }

  addLog(level, message) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      trace_id: `trace-${Date.now()}${getRandomInt(100, 999)}`
    };
    
    this.logs.unshift(logEntry);
    // Keep only last 50 logs
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(0, 50);
    }
    
    return logEntry;
  }

  updateStatus(newStatus) {
    if (this.status !== newStatus) {
      if (newStatus === 'critical') {
        this.awaitingRemediation = true;
        this.degradedMetrics = { ...this.metrics };
        this.addLog('ERROR', 'Service entered CRITICAL state - awaiting remediation');
      } else if (newStatus === 'warning' && this.status === 'healthy') {
        this.addLog('WARN', 'Service entered WARNING state');
      } else if (newStatus === 'healthy' && this.status !== 'healthy') {
        this.addLog('INFO', 'Service returned to HEALTHY state');
        this.awaitingRemediation = false;
        this.degradedMetrics = null;
      }
      
      this.status = newStatus;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      metrics: this.metrics,
      logs: this.logs.slice(0, 20),
      remediationInProgress: this.remediationInProgress,
      awaitingRemediation: this.awaitingRemediation,
      instanceCount: this.instanceCount,
      lastIncident: this.lastIncident
    };
  }
}

// In-memory services storage
let services = [];

function initializeServices() {
  services = [
    new Service('S1', 'Payment Gateway', 'critical'),
    new Service('S2', 'User Auth API', 'healthy'),
    new Service('S3', 'Inventory Service', 'warning'),
    new Service('S4', 'Reporting Engine', 'healthy'),
    new Service('S5', 'Search Indexer', 'healthy'),
    new Service('S6', 'Log Ingestion', 'healthy')
  ];
}

function getAllServices() {
  return services;
}

function getServiceById(id) {
  return services.find(service => service.id === id);
}

function resetAllServices() {
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
    service.logs = [];
    service.addLog('INFO', 'Service reset to healthy state');
    service.degradedMetrics = null;
  });
}

module.exports = {
  Service,
  getAllServices,
  getServiceById,
  initializeServices,
  resetAllServices
};