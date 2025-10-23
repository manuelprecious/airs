const axios = require('axios');
const logger = require('../utils/logger');
const { BACKEND_URL, REQUEST_TIMEOUT } = require('../config/constants');

class ServicePoller {
  constructor() {
    this.previousState = new Map();

    // Configure axios with timeout
    this.httpClient = axios.create({
      baseURL: BACKEND_URL,
      timeout: REQUEST_TIMEOUT
    });
  }

  async pollServices() {
    try {
      logger.info(`Polling backend at ${BACKEND_URL}/api/services...`);

      const response = await this.httpClient.get('/api/services');
      const services = response.data;

      logger.info(`✅ Successfully polled ${services.length} services`);
      return services;

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.error(`❌ Cannot connect to backend at ${BACKEND_URL}. Is the backend running?`);
      } else if (error.code === 'ENOTFOUND') {
        logger.error(`❌ Backend host not found: ${BACKEND_URL}`);
      } else if (error.response) {
        // Backend responded with error status
        logger.error(`❌ Backend responded with error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        // Request was made but no response received
        logger.error('❌ No response received from backend');
      } else {
        logger.error(`❌ Failed to poll services: ${error.message}`);
      }
      throw error;
    }
  }

  async getServiceDetails(serviceId) {
    try {
      const response = await this.httpClient.get(`/api/services/${serviceId}/metrics`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get details for service ${serviceId}:`, error.message);
      throw error;
    }
  }

  storeCurrentState(services) {
    const currentState = new Map();

    services.forEach(service => {
      currentState.set(service.id, {
        status: service.status,
        awaitingRemediation: service.awaitingRemediation,
        remediationInProgress: service.remediationInProgress,
        timestamp: new Date().toISOString()
      });
    });

    this.previousState = currentState;
    return currentState;
  }

  getPreviousState() {
    return this.previousState;
  }

  // ✅ ADD THIS METHOD: Batch health checking
  async checkAllServicesHealth(services) {
    const serviceIds = services.map(s => s.id).join(',');
    const prompt = `Check health for: ${serviceIds}`;

    const estimatedTokens = Math.ceil(prompt.length / 4);

    // Check if we have token capacity
    if (this.remediator && this.remediator.canMakeRequest(estimatedTokens)) {
      try {
        const response = await this.callLangflow('health-flow', prompt);
        this.remediator.recordTokenUsage(estimatedTokens);
        return this.parseBatchHealthResponse(response);
      } catch (error) {
        console.log('Batch health check failed, falling back to individual checks');
      }
    }

    // Fallback to individual checks
    return this.checkServicesIndividually(services);
  }

  // ✅ ADD THIS METHOD: Fallback individual checks
  async checkServicesIndividually(services) {
    const results = [];
    for (const service of services) {
      // Use existing individual check logic
      const health = await this.getServiceHealth(service.id);
      results.push(health);
    }
    return results;
  }
}

module.exports = ServicePoller;