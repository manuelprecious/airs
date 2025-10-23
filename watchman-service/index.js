const ServicePoller = require('./services/poller');
const CriticalDetector = require('./services/detector');
const AutoRemediator = require('./services/remediator');
const logger = require('./utils/logger');

class AIWatchman {
  constructor() {
    try {
      console.log('🚀 Initializing AIRS Watchman Service...');
      this.poller = new ServicePoller();
      this.detector = new CriticalDetector();
      this.remediator = new AutoRemediator(this.poller);
      this.isRunning = false;
      this.currentInterval = null;
      console.log('✅ AIRS Watchman Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AIRS Watchman Service:', error);
      throw error;
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

    // Keep the process alive
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
      console.log(`📊 Retrieved ${services.length} services from backend`);
      
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

      // Log system status
      this.logSystemStatus(detectionResult);

      // ONLY trigger Langflow for new critical services
      for (const service of detectionResult.newCriticalServices) {
        console.log(`🔔 Watchman detected critical service: ${service.name} (${service.id}) - Notifying Langflow`);
        await this.remediator.triggerRemediation(service.id);
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