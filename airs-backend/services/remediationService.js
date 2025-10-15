const { REMEDIATION_CONFIG } = require('../config/constants');

function remediateService(service, action, reason) {
  return new Promise((resolve) => {
    service.remediationInProgress = true;
    service.awaitingRemediation = false;
    service.lastIncident = {
      timestamp: new Date().toISOString(),
      action_taken: action,
      reason: reason,
      pre_remediation_metrics: service.degradedMetrics ? { ...service.degradedMetrics } : { ...service.metrics }
    };

    service.addLog('INFO', `Remediation started: ${action} - Reason: ${reason}`);

    const config = REMEDIATION_CONFIG[action] || { time: 4000, successProbability: 0.5 };
    
    // Log specific action
    const actionMessages = {
      restart_service: 'Initiating service restart...',
      scale_instances: 'Scaling service instances...',
      scale_memory: 'Allocating additional memory...',
      clear_cache: 'Clearing service cache...',
      kill_connections: 'Terminating stale connections...'
    };
    
    service.addLog('INFO', actionMessages[action] || `Executing ${action}...`);

    // Simulate remediation process
    setTimeout(() => {
      const success = Math.random() < config.successProbability;
      
      if (success) {
        // Reset to healthy state
        service.metrics = {
          cpu: Math.random() * 30 + 15,
          memory: Math.random() * 30 + 40,
          latency: Math.floor(Math.random() * 70 + 30),
          error_rate: Math.random() * 1.9 + 0.1,
          throughput: Math.floor(Math.random() * 700 + 800)
        };
        service.status = 'healthy';
        
        if (action === 'scale_instances') {
          service.instanceCount += 1;
          service.addLog('INFO', `Service scaled to ${service.instanceCount} instances`);
        }
        
        service.addLog('INFO', `Remediation SUCCESS: ${action}. Service restored to healthy state.`);
        service.degradedMetrics = null;
      } else {
        // Remediation failed
        service.addLog('ERROR', `Remediation FAILED: ${action}. Service remains in critical state.`);
        
        if (service.degradedMetrics) {
          service.metrics = {
            ...service.degradedMetrics,
            error_rate: service.degradedMetrics.error_rate + (Math.random() * 10 + 5)
          };
        }
        
        service.status = 'critical';
        service.awaitingRemediation = true;
      }
      
      service.remediationInProgress = false;
      resolve({
        success,
        action,
        service: service.toJSON()
      });
    }, config.time);
  });
}

module.exports = {
  remediateService
};