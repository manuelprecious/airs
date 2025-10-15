function analyzeLogs(service) {
  const recentErrors = service.logs
    .filter(log => log.level === 'ERROR' || log.level === 'WARN')
    .slice(0, 10)
    .map(log => log.message);

  const patterns = [];
  let suggestedActions = [];
  let rootCause = 'unknown';

  // Analyze error patterns
  if (recentErrors.some(error => 
    error.includes('CPU') || error.includes('thread') || error.includes('computational'))) {
    patterns.push('high_cpu_usage');
    suggestedActions.push('scale_instances', 'restart_service');
    rootCause = 'high_cpu_load';
  }

  if (recentErrors.some(error => 
    error.includes('memory') || error.includes('Memory') || error.includes('heap') || error.includes('GC'))) {
    patterns.push('memory_leak');
    suggestedActions.push('restart_service', 'scale_memory');
    rootCause = 'memory_exhaustion';
  }

  if (recentErrors.some(error => 
    error.includes('database') || error.includes('Database') || error.includes('connection') || error.includes('transaction'))) {
    patterns.push('database_connection_issues');
    suggestedActions.push('restart_service', 'kill_connections');
    rootCause = 'database_bottleneck';
  }

  if (recentErrors.some(error => 
    error.includes('timeout') || error.includes('latency') || error.includes('Network'))) {
    patterns.push('high_latency');
    suggestedActions.push('scale_instances', 'clear_cache');
    rootCause = 'network_latency';
  }

  // Default actions if no specific patterns
  if (suggestedActions.length === 0) {
    suggestedActions = ['restart_service', 'scale_instances'];
    rootCause = 'general_performance_issue';
  }

  return {
    recent_errors: recentErrors,
    patterns: [...new Set(patterns)],
    suggested_actions: [...new Set(suggestedActions)],
    root_cause: rootCause,
    analysis_timestamp: new Date().toISOString()
  };
}

module.exports = {
  analyzeLogs
};