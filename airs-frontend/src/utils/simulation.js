import { THRESHOLDS } from './constants';

export const updateMetricAndStatus = (service) => {
  let newValue = service.value;
  const { warn, crit } = THRESHOLDS[service.metric];

  const step = Math.max(2, (Math.random() * 0.15 + 0.10) * service.value);
  const fluctuation = step * (Math.random() < 0.5 ? 1 : -1);
  newValue = Math.max(1, newValue + fluctuation);

  let newStatus = 'HEALTHY';
  if (newValue >= crit) {
    newStatus = 'CRITICAL';
  } else if (newValue >= warn) {
    newStatus = 'WARNING';
  }

  const finalStatus = service.status === 'REMEDIATING' ? 'REMEDIATING' : newStatus;

  const newHistory = [
    ...service.history.slice(1),
    parseFloat(newValue.toFixed(service.metric === 'Latency_ms' ? 0 : 1))
  ];

  return {
    ...service,
    value: parseFloat(newValue.toFixed(service.metric === 'Latency_ms' ? 0 : 1)),
    status: finalStatus,
    history: newHistory,
  };
};