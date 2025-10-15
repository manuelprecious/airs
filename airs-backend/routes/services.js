const express = require('express');
const { getAllServices, getServiceById, resetAllServices } = require("../models/Service");
const { analyzeLogs } = require('../services/logService');
const { remediateService } = require('../services/remediationService');
const { LOAD_INTENSITIES } = require('../config/constants');
const { getRandomFloat, getRandomInt } = require('../utils/helpers');

const router = express.Router();

// Get all services overview
router.get('/services', (req, res) => {
  const services = getAllServices().map(service => ({
    id: service.id,
    name: service.name,
    status: service.status,
    remediationInProgress: service.remediationInProgress,
    awaitingRemediation: service.awaitingRemediation,
    instanceCount: service.instanceCount,
    lastIncident: service.lastIncident
  }));
  
  res.json(services);
});

// Get detailed metrics and logs for a specific service
router.get('/services/:id/metrics', (req, res) => {
  const service = getServiceById(req.params.id);
  
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  res.json(service.toJSON());
});

// Get log analysis for agent decision making
router.get('/services/:id/logs/analysis', (req, res) => {
  const service = getServiceById(req.params.id);
  
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const analysis = analyzeLogs(service);
  res.json(analysis);
});

// Simulate load on a service (to trigger issues)
router.post('/services/:id/simulate-load', (req, res) => {
  const service = getServiceById(req.params.id);
  
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
  const multiplier = LOAD_INTENSITIES[intensity] || 2.0;

  // Spike metrics based on intensity
  service.metrics.cpu = Math.min(100, service.metrics.cpu * multiplier);
  service.metrics.memory = Math.min(100, service.metrics.memory * multiplier);
  service.metrics.latency = service.metrics.latency * multiplier;
  service.metrics.error_rate = Math.min(50, service.metrics.error_rate * multiplier);
  service.metrics.throughput = service.metrics.throughput * 0.8;

  service.addLog('WARN', `Simulated ${intensity} load applied to service`);
  service.addLog('ERROR', `Performance degradation detected under ${intensity} load`);

  // Update status - if critical, freeze the service
  if (service.metrics.cpu >= 85 || service.metrics.error_rate >= 10) {
    service.updateStatus('critical');
  } else {
    service.updateStatus('warning');
  }

  res.json({
    message: `Applied ${intensity} load to ${service.name}`,
    current_metrics: service.metrics,
    status: service.status,
    awaiting_remediation: service.awaitingRemediation
  });
});

// Remediate a service (called by agent or manual override)
router.post('/services/:id/remediate', async (req, res) => {
  const service = getServiceById(req.params.id);
  
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
  
  const config = require('../config/constants').REMEDIATION_CONFIG[action];
  if (!config) {
    return res.status(400).json({ error: `Unknown remediation action: ${action}` });
  }

  try {
    const result = await remediateService(service, action, reason);
    
    res.json({
      message: `Remediation action '${action}' initiated`,
      estimated_completion: config.time,
      service_status: 'remediating',
      action_reason: reason,
      success_probability: config.successProbability
    });
  } catch (error) {
    res.status(500).json({ error: 'Remediation failed to start' });
  }
});

// Reset all services to healthy state (for testing)
router.post('/services/reset', (req, res) => {
  resetAllServices();
  res.json({ message: 'All services reset to healthy state' });
});

module.exports = router;