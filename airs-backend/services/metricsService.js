const { getAllServices } = require('../models/Service');
const { THRESHOLDS, ERROR_PATTERNS } = require('../config/constants');
const { getRandomFloat, getRandomInt } = require('../utils/helpers');

function updateServiceMetrics() {
  const services = getAllServices();
  
  services.forEach(service => {
    // Only update metrics if service is healthy or warning (not critical/awaiting remediation)
    if ((service.status === 'critical' && service.awaitingRemediation) || service.remediationInProgress) {
      return;
    }

    // Natural fluctuations
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

    // Update status if changed
    service.updateStatus(newStatus);

    // Occasionally generate warnings/errors for healthy services
    if (service.status === 'healthy' && Math.random() < 0.1) {
      const errorTypes = Object.keys(ERROR_PATTERNS);
      const randomErrorType = errorTypes[getRandomInt(0, errorTypes.length - 1)];
      const randomError = ERROR_PATTERNS[randomErrorType][getRandomInt(0, ERROR_PATTERNS[randomErrorType].length - 1)];
      
      service.addLog('WARN', randomError);
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
      service.addLog('INFO', infoMessages[getRandomInt(0, infoMessages.length - 1)]);
    }
  });
}

function startMetricsSimulation() {
  // Update metrics every 5 seconds
  setInterval(updateServiceMetrics, 5000);
  console.log('📈 Metrics simulation started (updates every 5 seconds)');
}

module.exports = {
  updateServiceMetrics,
  startMetricsSimulation
};