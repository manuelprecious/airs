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
  const { status, name, metric, value, history, alert_id } = service;
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

  return (
    <div className={`card ${statusClass}`}>
      <div className="card-header">
        <Icon className="card-icon" style={{ color: statusColor }} />
        <h3 className="card-title">{name}</h3>
        <span className={`status-pill ${statusClass}`}>{statusText}</span>
      </div>

      <div className="card-body">
        <div className="metric-value">
          {value}
          <span className="metric-unit">{unit}</span>
        </div>
        <div className="metric-details">
          <div className="metric-label">{metric}</div>
          {alert_id && (
            <div className="alert-id" style={{ color: statusColor }}>
              Alert: {alert_id}
            </div>
          )}
        </div>
      </div>

      <div className="sparkline-container">
        <Sparkline data={history} color={statusColor} />
      </div>

      <div className="card-footer">
        <div className={`agent-info ${status === 'REMEDIATING' ? 'agent-remediating' : ''}`}>
          <HardHat size={16} />
          <span>
            {status === 'REMEDIATING' ? 'Agent (AIRS) is Working' : 'Agent (AIRS) Monitoring'}
          </span>
        </div>

        <button
          onClick={handleRemediate}
          disabled={status === 'HEALTHY' || status === 'REMEDIATING'}
          className={`remediate-btn ${
            status === 'HEALTHY' || status === 'REMEDIATING' 
              ? 'remediate-btn-disabled' 
              : 'remediate-btn-enabled'
          }`}
        >
          <StatusIcon 
            size={18} 
            className={`mr-2 ${status === 'REMEDIATING' ? 'animate-spin' : ''}`} 
          />
          {status === 'REMEDIATING' ? 'Agent Action...' : 'Manual Override'}
        </button>
      </div>
    </div>
  );
});

export default ServiceCard;