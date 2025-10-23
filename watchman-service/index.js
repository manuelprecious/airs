const ServicePoller = require('./services/poller');
const CriticalDetector = require('./services/detector');
const AutoRemediator = require('./services/remediator');
const logger = require('./utils/logger');

class AIWatchman {
  constructor() {
    this.poller = new ServicePoller();
    this.detector = new CriticalDetector();
    this.remediator = new AutoRemediator();
    this.isRunning = false;
    this.currentInterval = null;
    // ✅ ADD THIS: Set up monitoring
    this.setupTokenMonitoring();

    // ✅ ADD THIS: Run compression test
    this.testCompression();
  }

  setupTokenMonitoring() {
    // Log token usage every minute
    setInterval(() => {
      const daily = this.remediator.dailyTokens;
      const minute = this.remediator.minuteTokens;
      const dailyPercent = ((daily / 500000) * 100).toFixed(1);
      const minutePercent = ((minute / 6000) * 100).toFixed(1);

      console.log(`📊 Token Usage: ${daily}/500K (${dailyPercent}%) daily, ${minute}/6K (${minutePercent}%) minute`);
    }, 60000);
  }

  // ✅ ADD THIS METHOD: Test token compression
  testCompression() {
    console.log("🧪 Testing token compression...");

    const testPrompts = [
      "Check system health",
      "Diagnose service S1",
      "Fix critical service S2"
    ];

    testPrompts.forEach(prompt => {
      const tokens = this.remediator.estimateTokens(prompt);
      console.log(`  "${prompt}" → ${tokens} tokens`);
    });
  }

  start() {
    if (this.isRunning) {
      logger.warn('Watchman is already running');
      return;
    }

    // logger.info('🚀 Starting AIRS Watchman Service...');
    console.log('🚀 Starting AIRS Watchman Service...');

    // ✅ ADD THIS: Show limits on startup
    console.log("✅ Optimization complete. Your Groq limits:");
    console.log("   Daily: 500,000 tokens = ~5.8 tokens/second");
    console.log("   Minute: 6,000 tokens = 100 tokens/second");
    console.log("   Requests: 30/minute = 1 request every 2 seconds");
    
    this.isRunning = true;

    // Start the polling loop immediately
    this.startPollingLoop();
  }

  stop() {
    if (this.currentInterval) {
      clearTimeout(this.currentInterval);
    }
    this.isRunning = false;
    logger.info('🛑 AIRS Watchman Service stopped');
  }

  async startPollingLoop() {
    if (!this.isRunning) return;

    try {
      logger.info('🔄 Starting polling cycle...');
      const services = await this.poller.pollServices();
      const pollingInterval = this.detector.calculatePollingInterval(services);

      // Process the current state
      await this.processServices(services);

      // Schedule next poll
      this.currentInterval = setTimeout(() => {
        this.startPollingLoop();
      }, pollingInterval * 1000);

      logger.info(`✅ Polling successful. Next poll in ${pollingInterval} seconds`);

    } catch (error) {
      logger.error('❌ Polling failed, retrying in 30 seconds');
      this.currentInterval = setTimeout(() => {
        this.startPollingLoop();
      }, 30000);
    }
  }

  async processServices(services) {
    const previousState = this.poller.getPreviousState();
    const detectionResult = this.detector.detectCriticalChanges(services, previousState);

    // Store current state for next comparison
    this.poller.storeCurrentState(services);

    // Log system status
    this.logSystemStatus(detectionResult);

    // Trigger remediation for new critical services
    for (const service of detectionResult.newCriticalServices) {
      await this.remediator.triggerRemediation(service.id);
    }
  }

  logSystemStatus(detectionResult) {
    const totalServices = detectionResult.stateChanges.length > 0 ?
      detectionResult.stateChanges[0].total : 'unknown';

    logger.info(`System Status: ${detectionResult.criticalCount} critical, ${detectionResult.warningCount} warnings`);

    if (detectionResult.newCriticalServices.length > 0) {
      logger.warn(`New critical services: ${detectionResult.newCriticalServices.map(s => s.name).join(', ')}`);
    }
  }

  async getCurrentStatus() {
    try {
      const services = await this.poller.pollServices();
      const previousState = this.poller.getPreviousState();
      const detectionResult = this.detector.detectCriticalChanges(services, previousState);

      return {
        timestamp: new Date().toISOString(),
        totalServices: services.length,
        critical: detectionResult.criticalCount,
        warnings: detectionResult.warningCount,
        healthy: services.length - detectionResult.criticalCount - detectionResult.warningCount,
        recentChanges: detectionResult.stateChanges.slice(0, 5),
        remediationHistory: this.remediator.getRemediationHistory()
      };
    } catch (error) {
      logger.error('Failed to get current status:', error);
      throw error;
    }
  }
}

// Initialize and start the watchman
const watchman = new AIWatchman();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  watchman.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  watchman.stop();
  process.exit(0);
});

// Start the service
watchman.start();

module.exports = watchman;