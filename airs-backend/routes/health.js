const express = require('express');
const { getAllServices } = require('../models/Service');

const router = express.Router();

// Get service health check
router.get('/health', (req, res) => {
  const services = getAllServices();
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

module.exports = router;