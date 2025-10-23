const logger = require('../utils/logger');

class TokenManager {
    constructor() {
        this.dailyTokens = 0;
        this.minuteTokens = 0;
        this.dailyRequests = 0;
        this.minuteRequests = 0;
        this.resetIntervals();
        
        logger.info('✅ Token Manager initialized: 500K daily, 6K/min token limits, 20K daily, 200/min request limits');
    }

    estimateTokens(text) {
        // More accurate token estimation
        const words = text.split(/\s+/).length;
        const chars = text.length;
        return Math.ceil((words + (chars / 3.5)) / 2);
    }

    canMakeRequest(estimatedTokens) {
        // 90% safety buffer for tokens
        if (this.dailyTokens + estimatedTokens > 450000) {
            logger.warn(`🚫 Daily token limit: ${this.dailyTokens}/450K`);
            return false;
        }
        if (this.minuteTokens + estimatedTokens > 5400) {
            logger.warn(`🚫 Minute token limit: ${this.minuteTokens}/5.4K`);
            return false;
        }
        
        // 90% safety buffer for requests
        if (this.dailyRequests + 1 > 18000) {
            logger.warn(`🚫 Daily request limit: ${this.dailyRequests}/18K`);
            return false;
        }
        if (this.minuteRequests + 1 > 180) {
            logger.warn(`🚫 Minute request limit: ${this.minuteRequests}/180`);
            return false;
        }
        
        return true;
    }

    recordRequest(tokens) {
        this.dailyTokens += tokens;
        this.minuteTokens += tokens;
        this.dailyRequests += 1;
        this.minuteRequests += 1;
        
        logger.debug(`📊 Usage: +${tokens}t +1r (Daily: ${this.dailyTokens}t/${this.dailyRequests}r, Minute: ${this.minuteTokens}t/${this.minuteRequests}r)`);
    }

    resetIntervals() {
        // Reset minute counters every 60 seconds
        setInterval(() => {
            this.minuteTokens = 0;
            this.minuteRequests = 0;
            logger.debug('🔄 Minute counters reset');
        }, 60000);

        // Reset daily counters every 24 hours  
        setInterval(() => {
            this.dailyTokens = 0;
            this.dailyRequests = 0;
            logger.debug('🔄 Daily counters reset');
        }, 24 * 60 * 60 * 1000);
    }

    getUsage() {
        return {
            tokens: {
                daily: this.dailyTokens,
                minute: this.minuteTokens,
                dailyLimit: 500000,
                minuteLimit: 6000
            },
            requests: {
                daily: this.dailyRequests,
                minute: this.minuteRequests,
                dailyLimit: 20000,
                minuteLimit: 200
            }
        };
    }

    // Fallback remediation when limits are hit
    async fallbackBasicRemediation(serviceId, poller) {
        try {
            logger.info(`🔄 Using fallback remediation for ${serviceId} (AI rate limited)`);
            
            // Get service data for rule-based decision
            const serviceData = await poller.getServiceDetails(serviceId);
            
            // Simple rule-based remediation
            let action = 'restart_service'; // Default fallback
            
            if (serviceData.metrics?.cpu > 85) {
                action = 'restart_service';
            } else if (serviceData.metrics?.memory > 85) {
                action = 'scale_memory'; 
            } else if (serviceData.metrics?.error_rate > 10) {
                action = 'kill_connections';
            } else if (serviceData.metrics?.latency > 800) {
                action = 'scale_instances';
            }
            
            // Execute directly via backend API
            const axios = require('axios');
            const response = await axios.post(
                `http://localhost:5000/api/services/${serviceId}/remediate`,
                {
                    action: action,
                    reason: 'Fallback remediation - AI rate limited'
                },
                { timeout: 30000 }
            );
            
            return {
                success: true,
                message: `Fallback remediation executed: ${action}`,
                fallback: true,
                action: action,
                data: response.data
            };
            
        } catch (error) {
            logger.error(`Fallback remediation failed for ${serviceId}: ${error.message}`);
            return { 
                success: false, 
                error: 'Both AI and fallback remediation failed',
                fallback: true
            };
        }
    }
}

module.exports = TokenManager;