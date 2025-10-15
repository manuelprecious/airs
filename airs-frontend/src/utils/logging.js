import { METRIC_UNITS } from './constants';

export const createLog = (type, service) => {
  const logId = Date.now() + Math.random();
  let message = '';

  switch(type) {
    case 'AGENT_TRIGGERED':
      message = `Incident Detected: ${service.name} entered CRITICAL state (${service.metric}: ${service.value}${METRIC_UNITS[service.metric]}). **AIRS Agent Triage Initiated.**`;
      break;
    case 'AGENT_SUCCESS':
      message = `Remediation Success: **AIRS Agent** validated ${service.name} health restored. Service stabilized.`;
      break;
    case 'MANUAL_OVERRIDE':
      message = `Manual Intervention: User initiated **Remediation Tool** for ${service.name}. Agent bypassed.`;
      break;
    case 'WARNING':
      message = `State Change: ${service.name} entered WARNING state (${service.metric}: ${service.value}${METRIC_UNITS[service.metric]}).`;
      break;
    default:
      message = `System Update: ${service.name} health check completed.`;
      break;
  }

  return {
    id: logId,
    timestamp: new Date().toISOString(),
    type: type,
    serviceName: service.name,
    metric: service.metric,
    value: service.value,
    message: message,
  };
};