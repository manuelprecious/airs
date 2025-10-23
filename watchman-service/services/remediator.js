const axios = require('axios');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { LANGFLOW_URL } = require('../config/constants');

class AutoRemediator {
  constructor(poller) {
    this.remediationHistory = new Map();
    this.poller = poller;
    this.persistentCriticalServices = new Map(); // Track persistently critical services
    
    this.httpClient = axios.create({
      timeout: 180000, // 3 minutes
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.flowId = 'a9fa6d4b-4f83-41e5-8072-a35c313648da'; // New automated flow ID
    
    logger.info(`✅ AutoRemediator initialized - Will trigger automated Langflow flow: ${this.flowId}`);
  }

  async triggerRemediation(serviceId) {
    try {
      logger.info(`🚨 Triggering automated remediation for service: ${serviceId}`);

      // Check persistent tracking for this service
      const now = Date.now();
      if (!this.persistentCriticalServices.has(serviceId)) {
        this.persistentCriticalServices.set(serviceId, {
          firstDetected: now,
          lastTriggered: 0,
          triggerCount: 0,
          lastStatus: 'critical'
        });
      }

      const serviceTracker = this.persistentCriticalServices.get(serviceId);
      const timeSinceLastTrigger = now - serviceTracker.lastTriggered;

      // Progressive backoff: 5min, 15min, 30min, then hourly
      const backoffSchedule = [300000, 900000, 1800000, 3600000]; // 5m, 15m, 30m, 1h
      const currentBackoff = backoffSchedule[Math.min(serviceTracker.triggerCount, backoffSchedule.length - 1)];

      if (timeSinceLastTrigger < currentBackoff) {
        const waitMinutes = Math.ceil((currentBackoff - timeSinceLastTrigger) / 60000);
        logger.info(`⏳ Service ${serviceId} in backoff period, next trigger in ${waitMinutes} minutes`);
        return { success: false, reason: 'backoff_period', wait_minutes: waitMinutes };
      }

      // Update tracker
      serviceTracker.lastTriggered = now;
      serviceTracker.triggerCount++;
      serviceTracker.lastAttempt = now;

      logger.info(`🔄 Attempt ${serviceTracker.triggerCount} for ${serviceId} (backoff: ${currentBackoff/60000}min)`);

      // Get service context for Langflow
      const serviceData = await this.poller.getServiceDetails(serviceId);
      
      // Update service status in tracker
      serviceTracker.lastStatus = serviceData.status;

      // Trigger Langflow automated flow
      const result = await this.triggerLangflowFlow(serviceId, serviceData, serviceTracker.triggerCount);

      if (result.success) {
        logger.info(`✅ Automated remediation triggered for ${serviceId} (attempt ${serviceTracker.triggerCount})`);
        
        // If successful after multiple attempts, log recovery time
        if (serviceTracker.triggerCount > 1) {
          const recoveryTime = Math.round((now - serviceTracker.firstDetected) / 60000);
          logger.info(`🎉 Service ${serviceId} recovered after ${recoveryTime} minutes and ${serviceTracker.triggerCount} attempts`);
        }
      } else {
        logger.error(`❌ Failed to trigger remediation for ${serviceId} (attempt ${serviceTracker.triggerCount})`);
      }

      return result;

    } catch (error) {
      logger.error(`❌ Failed to trigger remediation for ${serviceId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async triggerLangflowFlow(serviceId, serviceData, attemptNumber) {
    try {
      const url = `${LANGFLOW_URL}/api/v1/run/${this.flowId}`;
      
      const criticalMetrics = this.getCriticalMetrics(serviceData.metrics);
      const timeCritical = this.getTimeCritical(serviceId);
      
      const payload = {
        output_type: "chat",
        input_type: "chat",
        input_value: this.buildRemediationMessage(serviceId, serviceData, attemptNumber, criticalMetrics, timeCritical),
        session_id: randomUUID()
      };

      logger.info(`Calling automated Langflow API: ${url}`);
      const response = await this.httpClient.post(url, payload, {
        headers: {
          'x-api-key': 'sk-uTXm3_qimgYgVQdhqhj8nYRH3fmHjROVck5CAJZ5UmU',
          'Content-Type': 'application/json'
        },
        timeout: 180000
      });

      return {
        success: true,
        message: `Automated remediation triggered for ${serviceId}`,
        session_id: payload.session_id,
        attempt: attemptNumber,
        langflow_response: response.data
      };

    } catch (error) {
      logger.error(`Automated Langflow API call failed: ${error.message}`);
      if (error.response) {
        logger.error(`Langflow error details: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  buildRemediationMessage(serviceId, serviceData, attemptNumber, criticalMetrics, timeCritical) {
    return `🚨 CRITICAL SERVICE - AUTOMATED REMEDIATION WITH ESCALATION

Service: ${serviceData.name} (${serviceId})
Status: ${serviceData.status}
Critical Metrics: ${criticalMetrics.join(', ')}
Remediation Attempt: ${attemptNumber}
Time Critical: ${timeCritical}

Current State:
- CPU: ${serviceData.metrics.cpu}%
- Memory: ${serviceData.metrics.memory}%
- Error Rate: ${serviceData.metrics.error_rate}%
- Latency: ${serviceData.metrics.latency}ms

Remediation Context:
- Trigger: Watchman Persistent Monitoring
- Human Approval: NOT REQUIRED (fully automated)
- Intelligent Retry: ENABLED (attempt ${attemptNumber})
- Gmail Escalation: ENABLED to riddicksmith37@gmail.com
- Priority: HIGH - Service critical for ${timeCritical}

INSTRUCTIONS FOR AUTOMATED REMEDIATION AGENT:
1. Execute full diagnostic and remediation workflow automatically
2. Use intelligent retry with different strategies if actions fail
3. After 3 failures in this session, escalate via Gmail to riddicksmith37@gmail.com
4. Include detailed failure analysis in escalation
5. No human confirmation required for any actions

Execute complete automated remediation with escalation.`;
  }

  getCriticalMetrics(metrics) {
    const critical = [];
    
    if (metrics.cpu > 85) critical.push(`CPU: ${metrics.cpu}%`);
    if (metrics.memory > 85) critical.push(`Memory: ${metrics.memory}%`);
    if (metrics.error_rate > 10) critical.push(`Error Rate: ${metrics.error_rate}%`);
    if (metrics.latency > 500) critical.push(`Latency: ${metrics.latency}ms`);
    
    return critical.length > 0 ? critical : ['General performance degradation'];
  }

  getTimeCritical(serviceId) {
    if (!this.persistentCriticalServices.has(serviceId)) {
      return 'just detected';
    }
    
    const tracker = this.persistentCriticalServices.get(serviceId);
    const minutesCritical = Math.round((Date.now() - tracker.firstDetected) / 60000);
    
    if (minutesCritical < 1) return 'less than 1 minute';
    if (minutesCritical < 5) return `${minutesCritical} minutes`;
    if (minutesCritical < 60) return `${minutesCritical} minutes`;
    
    const hours = Math.floor(minutesCritical / 60);
    const remainingMinutes = minutesCritical % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  // Check all critical services and trigger remediation if backoff period passed
  async checkAndTriggerPersistentRemediation(services) {
    const criticalServices = services.filter(s => 
      s.status === 'critical' && s.awaitingRemediation
    );

    const results = [];
    
    for (const service of criticalServices) {
      // Check if we're tracking this service
      if (!this.persistentCriticalServices.has(service.id)) {
        // New critical service - trigger immediately
        logger.info(`🆕 New critical service detected: ${service.name} - triggering remediation`);
        const result = await this.triggerRemediation(service.id);
        results.push({ serviceId: service.id, serviceName: service.name, result });
      } else {
        // Existing critical service - check if we should retry
        const result = await this.triggerRemediation(service.id);
        if (result.success || result.reason !== 'backoff_period') {
          results.push({ serviceId: service.id, serviceName: service.name, result });
        }
      }
    }

    // Clean up services that are no longer critical
    this.cleanupRecoveredServices(services);

    return results;
  }

  cleanupRecoveredServices(currentServices) {
    const currentCriticalIds = new Set(
      currentServices.filter(s => s.status === 'critical').map(s => s.id)
    );

    for (const [serviceId, tracker] of this.persistentCriticalServices.entries()) {
      if (!currentCriticalIds.has(serviceId)) {
        // Service is no longer critical - clean up
        const criticalTime = Math.round((Date.now() - tracker.firstDetected) / 60000);
        logger.info(`✅ Service ${serviceId} recovered after ${criticalTime} minutes, removing from persistent tracking`);
        this.persistentCriticalServices.delete(serviceId);
      }
    }
  }

  getRemediationHistory() {
    return Array.from(this.remediationHistory.entries()).map(([serviceId, data]) => ({
      serviceId,
      ...data,
      lastTrigger: new Date(data.timestamp).toISOString()
    }));
  }

  getPersistentStatus() {
    const persistent = Array.from(this.persistentCriticalServices.entries()).map(([serviceId, data]) => ({
      serviceId,
      ...data,
      firstDetected: new Date(data.firstDetected).toISOString(),
      lastTriggered: new Date(data.lastTriggered).toISOString(),
      timeCritical: this.getTimeCritical(serviceId)
    }));

    return {
      persistent_critical_services: persistent,
      total_persistent: persistent.length,
      flow_id: this.flowId
    };
  }

  getStatus() {
    return {
      active_triggers: this.remediationHistory.size,
      persistent_critical: this.persistentCriticalServices.size,
      flow_id: this.flowId,
      last_trigger: this.remediationHistory.size > 0 ? 
        new Date(Math.max(...Array.from(this.remediationHistory.values()).map(d => d.timestamp))).toISOString() : 
        null
    };
  }
}

module.exports = AutoRemediator;