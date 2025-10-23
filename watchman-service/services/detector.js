const logger = require('../utils/logger');
const { STATES } = require('../config/constants');

class CriticalDetector {
  detectCriticalChanges(currentServices, previousState) {
    const newCriticalServices = [];
    const stateChanges = [];

    currentServices.forEach(service => {
      const previous = previousState.get(service.id);
      const currentStatus = service.status;
      const isCritical = currentStatus === STATES.CRITICAL && service.awaitingRemediation;
      
      // Check if this is a new critical service
      if (isCritical && (!previous || previous.status !== STATES.CRITICAL)) {
        newCriticalServices.push(service);
        stateChanges.push({
          serviceId: service.id,
          serviceName: service.name,
          change: 'healthy_to_critical',
          timestamp: new Date().toISOString()
        });
        logger.warn(`New critical service detected: ${service.name} (${service.id})`);
      }
      
      // Track status changes for logging
      if (previous && previous.status !== currentStatus) {
        stateChanges.push({
          serviceId: service.id,
          serviceName: service.name,
          change: `${previous.status}_to_${currentStatus}`,
          timestamp: new Date().toISOString()
        });
        logger.info(`Service ${service.name} changed: ${previous.status} → ${currentStatus}`);
      }
    });

    return {
      newCriticalServices,
      stateChanges,
      criticalCount: currentServices.filter(s => 
        s.status === STATES.CRITICAL && s.awaitingRemediation
      ).length,
      warningCount: currentServices.filter(s => s.status === STATES.WARNING).length,
      totalServices: currentServices.length
    };
  }

  calculatePollingInterval(services) {
    const { POLLING_INTERVALS, STATES } = require('../config/constants');
    
    const criticalCount = services.filter(s => 
      s.status === STATES.CRITICAL && s.awaitingRemediation
    ).length;
    
    const warningCount = services.filter(s => s.status === STATES.WARNING).length;

    if (criticalCount > 0) return POLLING_INTERVALS.CRITICAL;
    if (warningCount > 0) return POLLING_INTERVALS.DEGRADED;
    return POLLING_INTERVALS.NORMAL;
  }
}

module.exports = CriticalDetector;