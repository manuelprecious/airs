const ServicePoller = require('./services/poller');
const CriticalDetector = require('./services/detector');
const AutoRemediator = require('./services/remediator');
const logger = require('./utils/logger');
const express = require('express');

class AIWatchman {
  constructor() {
    try {
      console.log('🚀 Initializing AIRS Watchman Service...');
      this.poller = new ServicePoller();
      this.detector = new CriticalDetector();
      this.remediator = new AutoRemediator(this.poller);
      this.isRunning = false;
      this.currentInterval = null;
      
      // Track real remediation statistics
      this.remediationStats = {
        totalAttempts: 0,
        successfulRemediations: 0,
        failedRemediations: 0,
        activeRemediations: 0,
        remediationHistory: [],
        lastProcessedServices: new Map() // Track previous service states
      };
      
      // Initialize status server
      this.setupStatusServer();
      
      console.log('✅ AIRS Watchman Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AIRS Watchman Service:', error);
      throw error;
    }
  }

  // Setup status server on port 5001
  setupStatusServer() {
    this.statusApp = express();
    this.statusApp.use(express.json());
    
    // Status endpoint for watchman service
    this.statusApp.get('/status', (req, res) => {
      res.json({
        running: this.isRunning,
        lastHeartbeat: new Date().toISOString(),
        uptime: process.uptime(),
        polling_interval: this.detector ? 30 : 30,
        version: '2.1.0',
        services_monitored: this.currentServices ? this.currentServices.length : 0
      });
    });

    // Remediation statistics - NOW WITH REAL DATA
    this.statusApp.get('/remediation-stats', (req, res) => {
      const successRate = this.calculateSuccessRate();
      const systemLoad = this.calculateSystemLoad();
      
      res.json({
        total_fixes: this.remediationStats.successfulRemediations,
        success_rate: successRate,
        active_remediations: this.remediationStats.activeRemediations,
        system_load: systemLoad,
        total_attempts: this.remediationStats.totalAttempts,
        failed_remediations: this.remediationStats.failedRemediations,
        last_updated: new Date().toISOString()
      });
    });

    // Manual remediation recording endpoint
    this.statusApp.post('/record-remediation', (req, res) => {
      const { serviceId, serviceName, success } = req.body;
      
      if (serviceId && serviceName) {
        this.recordRemediationAttempt(serviceId, serviceName, success, 'manual');
        res.json({ 
          message: 'Remediation recorded',
          total_fixes: this.remediationStats.successfulRemediations
        });
      } else {
        res.status(400).json({ error: 'Missing serviceId or serviceName' });
      }
    });

    // Health check
    this.statusApp.get('/health', (req, res) => {
      res.json({
        status: this.isRunning ? 'healthy' : 'stopped',
        service: 'airs-watchman',
        timestamp: new Date().toISOString()
      });
    });

    // Get detailed remediation history
    this.statusApp.get('/remediation-history', (req, res) => {
      res.json({
        history: this.remediationStats.remediationHistory.slice(0, 20),
        summary: {
          total_fixes: this.remediationStats.successfulRemediations,
          success_rate: this.calculateSuccessRate(),
          total_attempts: this.remediationStats.totalAttempts
        }
      });
    });

    // Reset stats (for testing)
    this.statusApp.post('/reset-stats', (req, res) => {
      this.remediationStats = {
        totalAttempts: 0,
        successfulRemediations: 0,
        failedRemediations: 0,
        activeRemediations: 0,
        remediationHistory: [],
        lastProcessedServices: new Map()
      };
      res.json({ message: 'Statistics reset', stats: this.remediationStats });
    });

    // 404 handler
    this.statusApp.use((req, res) => {
      res.status(404).json({ error: 'Endpoint not found in watchman status server' });
    });

    // Start status server on port 5001
    const STATUS_PORT = process.env.STATUS_PORT || 5001;
    this.statusApp.listen(STATUS_PORT, () => {
      console.log(`📊 Watchman status server running on port ${STATUS_PORT}`);
    });
  }

  // Calculate success rate based on actual remediation history
  calculateSuccessRate() {
    if (this.remediationStats.totalAttempts === 0) {
      return "0%";
    }
    
    const successRate = (this.remediationStats.successfulRemediations / this.remediationStats.totalAttempts) * 100;
    return `${Math.round(successRate)}%`;
  }

  // Calculate system load based on current service states
  calculateSystemLoad() {
    if (!this.currentServices || this.currentServices.length === 0) {
      return "Unknown";
    }
    
    const criticalCount = this.currentServices.filter(s => 
      s.status === 'critical' && s.awaitingRemediation
    ).length;
    
    const warningCount = this.currentServices.filter(s => s.status === 'warning').length;
    const totalServices = this.currentServices.length;
    
    const criticalPercentage = (criticalCount / totalServices) * 100;
    const warningPercentage = (warningCount / totalServices) * 100;
    
    if (criticalPercentage > 30) return "Critical";
    if (criticalPercentage > 15 || warningPercentage > 40) return "High";
    if (criticalPercentage > 5 || warningPercentage > 20) return "Medium";
    
    return "Low";
  }

  // Record a remediation attempt
  recordRemediationAttempt(serviceId, serviceName, success = false, source = 'detected') {
    this.remediationStats.totalAttempts++;
    
    if (success) {
      this.remediationStats.successfulRemediations++;
      console.log(`✅ Recorded SUCCESSFUL remediation: ${serviceName} (${serviceId}) from ${source}`);
    } else {
      this.remediationStats.failedRemediations++;
      console.log(`❌ Recorded FAILED remediation: ${serviceName} (${serviceId}) from ${source}`);
    }
    
    const remediationRecord = {
      id: `remediation-${Date.now()}`,
      timestamp: new Date().toISOString(),
      serviceId,
      serviceName,
      success,
      source,
      totalAttempts: this.remediationStats.totalAttempts,
      successfulRemediations: this.remediationStats.successfulRemediations
    };
    
    this.remediationStats.remediationHistory.unshift(remediationRecord);
    
    // Keep only last 100 records
    if (this.remediationStats.remediationHistory.length > 100) {
      this.remediationStats.remediationHistory = this.remediationStats.remediationHistory.slice(0, 100);
    }
    
    console.log(`📝 Remediation Stats: ${this.remediationStats.successfulRemediations} successful, ${this.remediationStats.failedRemediations} failed, ${this.remediationStats.activeRemediations} active`);
  }

  // IMPROVED: Detect successful remediations by comparing service states
  detectSuccessfulRemediations(currentServices) {
    if (!this.remediationStats.lastProcessedServices.size) {
      // First run, just store the current state
      currentServices.forEach(service => {
        this.remediationStats.lastProcessedServices.set(service.id, {
          status: service.status,
          awaitingRemediation: service.awaitingRemediation,
          remediationInProgress: service.remediationInProgress,
          timestamp: new Date().toISOString()
        });
      });
      return;
    }

    let detectedCount = 0;

    // Check for services that were critical/remediating and are now healthy
    currentServices.forEach(service => {
      const previousState = this.remediationStats.lastProcessedServices.get(service.id);
      
      if (previousState) {
        const wasInBadState = previousState.status === 'critical' || 
                             previousState.remediationInProgress || 
                             previousState.awaitingRemediation;
        
        const isNowHealthy = service.status === 'healthy' && 
                            !service.remediationInProgress && 
                            !service.awaitingRemediation;
        
        // Service recovered from bad state to healthy
        if (wasInBadState && isNowHealthy) {
          // Check if we already recorded this remediation recently
          const recentRemediation = this.remediationStats.remediationHistory.find(
            r => r.serviceId === service.id && 
                 Date.now() - new Date(r.timestamp).getTime() < 60000 // Within 60 seconds
          );
          
          if (!recentRemediation) {
            console.log(`🎉 Detected successful remediation for ${service.name} (state change: ${previousState.status} → healthy)`);
            this.recordRemediationAttempt(service.id, service.name, true, 'detected');
            detectedCount++;
          }
        }
      }
      
      // Update the stored state
      this.remediationStats.lastProcessedServices.set(service.id, {
        status: service.status,
        awaitingRemediation: service.awaitingRemediation,
        remediationInProgress: service.remediationInProgress,
        timestamp: new Date().toISOString()
      });
    });

    if (detectedCount > 0) {
      console.log(`📈 Detected ${detectedCount} new successful remediations`);
    }
  }

  start() {
    if (this.isRunning) {
      console.log('Watchman is already running');
      return;
    }

    console.log('🚀 Starting AIRS Watchman Service (Observer Mode)...');
    console.log('✅ Watchman Role: Detect & Notify | Langflow Role: Auto-Remediate');
    
    this.isRunning = true;
    this.startPollingLoop();

    console.log('🔄 Watchman service is now running and will poll continuously...');
  }

  stop() {
    if (this.currentInterval) {
      clearTimeout(this.currentInterval);
    }
    this.isRunning = false;
    console.log('🛑 AIRS Watchman Service stopped');
  }

  async startPollingLoop() {
    if (!this.isRunning) {
      console.log('Watchman is not running, stopping polling loop');
      return;
    }

    try {
      console.log('🔄 Starting polling cycle...');
      const services = await this.poller.pollServices();
      this.currentServices = services;
      
      console.log(`📊 Retrieved ${services.length} services from backend`);
      
      // NEW: Detect successful remediations from state changes
      this.detectSuccessfulRemediations(services);
      
      const pollingInterval = this.detector.calculatePollingInterval(services);
      console.log(`⏰ Next poll in ${pollingInterval} seconds`);

      // Process the current state
      await this.processServices(services);

      // Schedule next poll
      this.currentInterval = setTimeout(() => {
        this.startPollingLoop();
      }, pollingInterval * 1000);

      console.log(`✅ Polling cycle completed. Next poll scheduled in ${pollingInterval} seconds`);

    } catch (error) {
      console.error('❌ Polling failed:', error.message);
      console.log('🔄 Retrying in 30 seconds...');
      
      this.currentInterval = setTimeout(() => {
        this.startPollingLoop();
      }, 30000);
    }
  }

  async processServices(services) {
    try {
      const previousState = this.poller.getPreviousState();
      const detectionResult = this.detector.detectCriticalChanges(services, previousState);

      // Store current state for next comparison
      this.poller.storeCurrentState(services);

      // Update active remediation count
      this.remediationStats.activeRemediations = services.filter(s => 
        s.remediationInProgress
      ).length;

      // Log system status
      this.logSystemStatus(detectionResult);

      // ONLY trigger Langflow for new critical services
      for (const service of detectionResult.newCriticalServices) {
        console.log(`🔔 Watchman detected critical service: ${service.name} (${service.id}) - Notifying Langflow`);
        
        // Record the remediation attempt (initially as failed)
        this.recordRemediationAttempt(service.id, service.name, false, 'watchman');
        
        const result = await this.remediator.triggerRemediation(service.id);
        
        // If Langflow reports success, update the record
        if (result && result.success) {
          const lastAttempt = this.remediationStats.remediationHistory.find(
            r => r.serviceId === service.id && !r.success && r.source === 'watchman'
          );
          if (lastAttempt) {
            lastAttempt.success = true;
            this.remediationStats.failedRemediations--;
            this.remediationStats.successfulRemediations++;
            console.log(`✅ Updated remediation to SUCCESS for ${service.name}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error processing services:', error);
    }
  }

  logSystemStatus(detectionResult) {
    if (detectionResult.newCriticalServices.length > 0) {
      console.log(`📢 New critical services detected: ${detectionResult.newCriticalServices.map(s => s.name).join(', ')}`);
    }
    
    const healthyCount = detectionResult.totalServices - detectionResult.criticalCount - detectionResult.warningCount;
    console.log(`📊 System Status: ${detectionResult.criticalCount} critical, ${detectionResult.warningCount} warnings, ${healthyCount} healthy`);
    
    // Log remediation stats
    console.log(`🛠️  Remediation Stats: ${this.remediationStats.successfulRemediations} successful, ${this.remediationStats.failedRemediations} failed, ${this.remediationStats.activeRemediations} active`);
  }
}

// Initialize and start the watchman
try {
  const watchman = new AIWatchman();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    watchman.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    watchman.stop();
    process.exit(0);
  });

  // Start the service
  watchman.start();

  // Keep the process alive
  setInterval(() => {
    // This keeps the event loop busy
  }, 1000);

  module.exports = watchman;
} catch (error) {
  console.error('💥 Failed to start AIRS Watchman Service:', error);
  process.exit(1);
}