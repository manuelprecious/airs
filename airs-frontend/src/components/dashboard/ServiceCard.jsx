import React, { useMemo } from 'react';
import { 
  Zap, Cpu, Server, Clock, AlertTriangle, HardHat, 
  RefreshCw, CheckCircle, XCircle 
} from 'lucide-react';
import Sparkline from '../common/Sparkline';
import { 
  METRIC_UNITS, 
  STATUS_CLASSES, 
  STATUS_COLORS 
} from '../../utils/constants';

const ServiceCard = React.memo(({ service, startRemediation }) => {
  const { status, name, metric, value, history, alert_id, backendData, allMetrics } = service;
  const unit = METRIC_UNITS[metric];
  const statusText = status.toUpperCase();
  const statusClass = STATUS_CLASSES[status];
  const statusColor = STATUS_COLORS[status];

  const Icon = useMemo(() => {
    switch (metric) {
      case 'CPU_Load': return Cpu;
      case 'Memory_Use': return Server;
      case 'Latency_ms': return Clock;
      case 'Error_Rate': return AlertTriangle;
      case 'Disk_IO_Wait': return HardHat;
      default: return Zap;
    }
  }, [metric]);

  const StatusIcon = useMemo(() => {
    if (status === 'REMEDIATING') return RefreshCw;
    if (status === 'HEALTHY') return CheckCircle;
    return XCircle;
  }, [status]);

  const handleRemediate = () => {
    if (status !== 'REMEDIATING') {
      startRemediation(service.id, service, true);
    }
  };

  // Get instance count from backend data
  const instanceCount = backendData?.instanceCount || 1;

  // Safe formatValue function with fallbacks
  const formatValue = (val, metricType) => {
    // Handle undefined or null values
    if (val === undefined || val === null) {
      return metricType === 'Latency_ms' ? 0 : 0.0;
    }
    
    // Ensure val is a number
    const numericValue = typeof val === 'number' ? val : parseFloat(val) || 0;
    
    if (metricType === 'Latency_ms') return Math.round(numericValue);
    return parseFloat(numericValue.toFixed(1));
  };

  // Safe value for display
  const displayValue = formatValue(value, metric);

  // Get metric color based on value and thresholds
  const getMetricColor = (value, metricType) => {
    if (metricType === 'CPU_Load') {
      return value > 80 ? 'text-red-500' : value > 65 ? 'text-yellow-500' : 'text-green-500';
    } else if (metricType === 'Memory_Use') {
      return value > 80 ? 'text-red-500' : value > 70 ? 'text-yellow-500' : 'text-green-500';
    } else if (metricType === 'Latency_ms') {
      return value > 800 ? 'text-red-500' : value > 500 ? 'text-yellow-500' : 'text-green-500';
    } else if (metricType === 'Error_Rate') {
      return value > 10 ? 'text-red-500' : value > 5 ? 'text-yellow-500' : 'text-green-500';
    } else if (metricType === 'Disk_IO_Wait') {
      return value > 20 ? 'text-red-500' : value > 15 ? 'text-yellow-500' : 'text-green-500';
    }
    return 'text-green-500';
  };

  return (
    <div className={`card ${statusClass}`}>
      <div className="card-header">
        <Icon className="card-icon" style={{ color: statusColor }} />
        <div className="flex-1 min-w-0">
          <h3 className="card-title truncate" title={name}>{name}</h3>
          {backendData && (
            <div className="text-xs text-gray-500 mt-1">
              Instances: {instanceCount}
              {backendData.lastIncident && (
                <span className="ml-2">• Last incident: {new Date(backendData.lastIncident).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>
        <span className={`status-pill ${statusClass}`}>{statusText}</span>
      </div>

      <div className="card-body">
        <div className="metric-value">
          {displayValue}
          <span className="metric-unit">{unit}</span>
        </div>
        <div className="metric-details">
          <div className="metric-label">{metric.replace('_', ' ')}</div>
          {alert_id && (
            <div className="alert-id" style={{ color: statusColor }}>
              Alert: {alert_id}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Sparkline - ensure history is defined */}
      <div className="sparkline-container">
        <Sparkline data={history || []} color={statusColor} />
      </div>

      {/* Show all available metrics in 2x2 grid */}
      {allMetrics && (
        <div className="additional-metrics">
          <div className="metrics-grid-2x2">
            {/* Row 1 */}
            <div className="metric-cell">
              <div className="metric-icon">
                <Cpu size={12} />
              </div>
              <div className="metric-info">
                <div className="metric-name">CPU</div>
                <div className={`metric-value-small ${getMetricColor(allMetrics.cpu, 'CPU_Load')}`}>
                  {formatValue(allMetrics.cpu, 'CPU_Load')}%
                </div>
              </div>
            </div>
            
            <div className="metric-cell">
              <div className="metric-icon">
                <Server size={12} />
              </div>
              <div className="metric-info">
                <div className="metric-name">Memory</div>
                <div className={`metric-value-small ${getMetricColor(allMetrics.memory, 'Memory_Use')}`}>
                  {formatValue(allMetrics.memory, 'Memory_Use')}%
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="metric-cell">
              <div className="metric-icon">
                <Clock size={12} />
              </div>
              <div className="metric-info">
                <div className="metric-name">Latency</div>
                <div className={`metric-value-small ${getMetricColor(allMetrics.latency, 'Latency_ms')}`}>
                  {formatValue(allMetrics.latency, 'Latency_ms')}ms
                </div>
              </div>
            </div>
            
            <div className="metric-cell">
              <div className="metric-icon">
                <AlertTriangle size={12} />
              </div>
              <div className="metric-info">
                <div className="metric-name">Errors</div>
                <div className={`metric-value-small ${getMetricColor(allMetrics.error_rate, 'Error_Rate')}`}>
                  {formatValue(allMetrics.error_rate, 'Error_Rate')}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card-footer">
        <div className={`agent-info ${status === 'REMEDIATING' ? 'agent-remediating' : ''}`}>
          <HardHat size={16} />
          <span>
            {status === 'REMEDIATING' 
              ? 'Agent (AIRS) is Working' 
              : backendData?.awaitingRemediation 
                ? 'Awaiting Remediation' 
                : 'Agent (AIRS) Monitoring'
            }
          </span>
        </div>

        <button
          onClick={handleRemediate}
          disabled={status === 'HEALTHY' || status === 'REMEDIATING' || backendData?.awaitingRemediation}
          className={`remediate-btn ${
            status === 'HEALTHY' || status === 'REMEDIATING' || backendData?.awaitingRemediation
              ? 'remediate-btn-disabled' 
              : 'remediate-btn-enabled'
          }`}
          title={
            backendData?.awaitingRemediation 
              ? 'Service is already queued for remediation' 
              : status === 'HEALTHY'
              ? 'Service is healthy, no remediation needed'
              : 'Start manual remediation'
          }
        >
          <StatusIcon 
            size={16} 
            className={`mr-2 ${status === 'REMEDIATING' ? 'animate-spin' : ''}`} 
          />
          {status === 'REMEDIATING' 
            ? 'Agent Action...' 
            : backendData?.awaitingRemediation
            ? 'Queued for Remediation'
            : 'Manual Override'
          }
        </button>
      </div>
    </div>
  );
});

export default ServiceCard;