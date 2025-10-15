import React from 'react';
import { XCircle, CheckCircle, Users, AlertTriangle, Clock10 } from 'lucide-react';
import { STATUS_COLORS } from '../../utils/constants';

const LogItem = ({ log }) => {
  const date = new Date(log.timestamp);
  const timeString = date.toLocaleTimeString();

  let icon, color;
  switch (log.type) {
    case 'AGENT_TRIGGERED':
      icon = <XCircle size={18} />;
      color = STATUS_COLORS['AGENT_TRIGGERED'];
      break;
    case 'AGENT_SUCCESS':
      icon = <CheckCircle size={18} />;
      color = STATUS_COLORS['AGENT_SUCCESS'];
      break;
    case 'MANUAL_OVERRIDE':
      icon = <Users size={18} />;
      color = STATUS_COLORS['MANUAL_OVERRIDE'];
      break;
    case 'WARNING':
      icon = <AlertTriangle size={18} />;
      color = STATUS_COLORS['WARNING'];
      break;
    default:
      icon = <Clock10 size={18} />;
      color = STATUS_COLORS['REMEDIATING'];
      break;
  }

  return (
    <div className="log-item">
      <div className="log-icon" style={{ color: color }}>{icon}</div>
      <div className="log-content">
        <p className="log-message" dangerouslySetInnerHTML={{ __html: log.message }}></p>
        <div className="log-meta">
          <span>{timeString}</span>
          <span className="log-type" style={{ backgroundColor: color, color: 'var(--bg-dark)' }}>
            {log.type.replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LogItem;