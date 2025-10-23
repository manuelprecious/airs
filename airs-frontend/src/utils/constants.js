export const SIMULATION_INTERVAL_MS = 1500;
export const REMEDIATION_DELAY_MS = 4000;
export const MAX_HISTORY = 30;
export const MAX_LOGS = 100;
export const LOCAL_STORAGE_KEY = 'sre_dashboard_state_airs_v6';
export const THEME_STORAGE_KEY = 'sre_dashboard_theme_v5';

export const METRIC_UNITS = {
  'CPU_Load': '%',
  'Memory_Use': '%',
  'Latency_ms': 'ms',
  'Error_Rate': '%',
  'Disk_IO_Wait': 's',
};

export const THRESHOLDS = {
  'CPU_Load': { warn: 65, crit: 85 },
  'Memory_Use': { warn: 70, crit: 90 },
  'Latency_ms': { warn: 500, crit: 800 },
  'Error_Rate': { warn: 10, crit: 20 },
  'Disk_IO_Wait': { warn: 15, crit: 25 },
};

export const STATUS_CLASSES = {
  'HEALTHY': 'status-healthy',
  'WARNING': 'status-warning',
  'CRITICAL': 'status-critical',
  'REMEDIATING': 'status-remediating',
};

export const STATUS_COLORS = {
  'HEALTHY': '#10b981',
  'WARNING': '#f59e0b',
  'CRITICAL': '#ef4444',
  'REMEDIATING': '#3b82f6',
  'AGENT_SUCCESS': '#22c55e',
  'AGENT_TRIGGERED': '#ef4444',
  'MANUAL_OVERRIDE': '#a855f7',
  'AI_ACTIVE': '#8b5cf6', // Purple for AI
  'WATCHMAN_RUNNING': '#10b981', // Green for running
  'WATCHMAN_STOPPED': '#ef4444', // Red for stopped
};

export const DEFAULT_SERVICES = [
  { id: 'S1', name: 'Payment Gateway', status: 'CRITICAL', metric: 'CPU_Load', value: 92.0, history: Array(MAX_HISTORY).fill(92), alert_id: 'ALERT-001' },
  { id: 'S2', name: 'User Auth API', status: 'HEALTHY', metric: 'Memory_Use', value: 35.0, history: Array(MAX_HISTORY).fill(35), alert_id: null },
  { id: 'S3', name: 'Inventory Service', status: 'WARNING', metric: 'Latency_ms', value: 650, history: Array(MAX_HISTORY).fill(650), alert_id: 'WARN-003' },
  { id: 'S4', name: 'Reporting Engine', status: 'HEALTHY', metric: 'Error_Rate', value: 5, history: Array(MAX_HISTORY).fill(5), alert_id: null },
  { id: 'S5', name: 'Search Indexer', status: 'WARNING', metric: 'Disk_IO_Wait', value: 18.0, history: Array(MAX_HISTORY).fill(18), alert_id: 'WARN-005' },
  { id: 'S6', name: 'Log Ingestion', status: 'HEALTHY', metric: 'CPU_Load', value: 25.0, history: Array(MAX_HISTORY).fill(25), alert_id: null },
];