const axios = require('axios');
const logger = require('../utils/logger');
const { LANGFLOW_URL } = require('../config/constants');
const TokenManager = require('./token_manager');

class AutoRemediator {
  constructor(poller) {
    this.remediationHistory = new Map();
    this.tokenManager = new TokenManager();
    this.poller = poller; // Add poller for fallback remediation
    
    this.httpClient = axios.create({
      timeout: 30000
    });
    
    logger.info('✅ AutoRemediator initialized with token management');
  }

  async triggerRemediation(serviceId) {
    try {
      logger.info(`🚨 Triggering AI remediation workflow for service: ${serviceId}`);

      // Check if we already have an active remediation for this service
      if (this.remediationHistory.has(serviceId)) {
        const lastAttempt = this.remediationHistory.get(serviceId);
        const timeSinceLastAttempt = Date.now() - lastAttempt.timestamp;

        // Don't retry too frequently (wait at least 2 minutes)
        if (timeSinceLastAttempt < 120000) {
          logger.warn(`Skipping AI trigger for ${serviceId} - too soon after last attempt`);
          return { success: false, reason: 'too_soon' };
        }
      }

      // Record this remediation attempt
      this.remediationHistory.set(serviceId, {
        timestamp: Date.now(),
        attempts: (this.remediationHistory.get(serviceId)?.attempts || 0) + 1
      });

      // Trigger the Langflow AI workflow with token management
      const result = await this.triggerLangflowWorkflow(serviceId);

      logger.info(`✅ AI workflow triggered for ${serviceId}: ${result.message}`);
      return result;

    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error.response) {
        errorMessage = `Langflow error ${error.response.status}: ${error.response.data?.error || 'No error details'}`;
      } else if (error.request) {
        errorMessage = 'No response from Langflow';
      } else {
        errorMessage = error.message;
      }

      logger.error(`❌ AI workflow trigger failed for ${serviceId}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  async triggerLangflowWorkflow(serviceId) {
    try {
      logger.info(`Calling Langflow API for service ${serviceId}...`);

      // Estimate tokens for this request
      const prompt = `Critical service: ${serviceId}`;
      const estimatedTokens = this.tokenManager.estimateTokens(prompt);
      
      // Check if we can make the request within limits
      if (!this.tokenManager.canMakeRequest(estimatedTokens)) {
        logger.warn(`🚫 Token/request limits reached, using fallback remediation for service ${serviceId}`);
        return await this.tokenManager.fallbackBasicRemediation(serviceId, this.poller);
      }

      // Make the AI API call
      const response = await this.httpClient.post(
        `${LANGFLOW_URL}/api/trigger-remediation`,
        {
          service_id: serviceId,
          trigger_source: 'watchman_auto',
          timestamp: new Date().toISOString()
        }
      );

      // Record successful token usage
      this.tokenManager.recordRequest(estimatedTokens);

      logger.info(`Langflow response: ${JSON.stringify(response.data)}`);

      return {
        success: true,
        message: `AI remediation workflow started for ${serviceId}`,
        workflow_id: response.data.workflow_id,
        status: response.data.status,
        tokens_used: estimatedTokens
      };

    } catch (error) {
      logger.error(`Langflow API call failed: ${error.message}`);
      
      if (error.response) {
        logger.error(`Langflow error details: ${JSON.stringify(error.response.data)}`);
        
        // If it's a 429 rate limit error, use fallback
        if (error.response.status === 429) {
          logger.warn(`🔄 Langflow rate limit hit, using fallback remediation for ${serviceId}`);
          return await this.tokenManager.fallbackBasicRemediation(serviceId, this.poller);
        }
      }
      
      throw error;
    }
  }

  getRemediationHistory() {
    return Array.from(this.remediationHistory.entries()).map(([serviceId, data]) => ({
      serviceId,
      ...data,
      lastAttempt: new Date(data.timestamp).toISOString()
    }));
  }

  getTokenUsage() {
    return this.tokenManager.getUsage();
  }

  // Single-shot remediation for critical services (1 LLM call instead of agent chain)
  async singleShotRemediation(serviceId) {
    try {
      logger.info(`🚀 Starting single-shot remediation for service: ${serviceId}`);
      
      // Step 1: Pre-collect ALL data (no LLM calls)
      const serviceData = await this.poller.getServiceDetails(serviceId);
      const logAnalysis = await this.poller.getServiceLogAnalysis(serviceId);
      const systemOverview = await this.poller.pollServices();
      
      // Step 2: Create compressed context
      const compressedContext = {
        health: `S${serviceId}:${serviceData.status}|C:${serviceData.metrics.cpu}|M:${serviceData.metrics.memory}|E:${serviceData.metrics.error_rate}`,
        logs: `S${serviceId}:${logAnalysis.root_cause}|P:${logAnalysis.patterns.join(',')}|A:${logAnalysis.suggested_actions.join(',')}`,
        system: `Total:${systemOverview.length}|H:${systemOverview.filter(s => s.status === 'healthy').length}|W:${systemOverview.filter(s => s.status === 'warning').length}|C:${systemOverview.filter(s => s.status === 'critical').length}`
      };
      
      // Step 3: Estimate tokens for single LLM call
      const prompt = JSON.stringify(compressedContext);
      const estimatedTokens = this.tokenManager.estimateTokens(prompt);
      
      // Step 4: Check limits and proceed
      if (!this.tokenManager.canMakeRequest(estimatedTokens)) {
        logger.warn(`🚫 Token limits for single-shot, using fallback for ${serviceId}`);
        return await this.tokenManager.fallbackBasicRemediation(serviceId, this.poller);
      }

      // Step 5: Single LLM call to unified agent
      const response = await this.httpClient.post(
        `${LANGFLOW_URL}/api/trigger-remediation`,
        {
          service_id: serviceId,
          compressed_context: `${compressedContext.health} | ${compressedContext.logs} | ${compressedContext.system}`,
          trigger_source: 'watchman_single_shot',
          timestamp: new Date().toISOString()
        }
      );

      // Step 6: Record token usage
      this.tokenManager.recordRequest(estimatedTokens);

      logger.info(`✅ Single-shot remediation triggered for ${serviceId}`);
      return {
        success: true,
        message: `Single-shot remediation started for ${serviceId}`,
        workflow_id: response.data.workflow_id,
        status: response.data.status,
        tokens_used: estimatedTokens,
        method: 'single_shot'
      };
      
    } catch (error) {
      logger.error(`❌ Single-shot remediation failed for ${serviceId}: ${error.message}`);
      // Fallback to original agent chain
      return await this.triggerRemediation(serviceId);
    }
  }
}

module.exports = AutoRemediator;