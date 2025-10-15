import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
    Zap, Clock, Activity, HardHat, Server, Terminal, RefreshCw, AlertTriangle,
    CheckCircle, XCircle, Cpu, LayoutDashboard, Users, Settings, Search, Bell,
    User, Menu, Clock10, Check, Sun, Moon, ArrowUp, ArrowDown, ChevronLeft, ChevronRight
} from "lucide-react";
import "./App.css"

// --- CONFIGURATION CONSTANTS ---
const SIMULATION_INTERVAL_MS = 5000; // Match backend update interval (5s)
const REMEDIATION_DELAY_MS = 4000; // Simulates time for Agent to Triage, Act, and Validate (4s)
const MAX_HISTORY = 30; // Max points to store in service history
const MAX_LOGS = 100; // Max logs to store for the Audit Timeline
const LOCAL_STORAGE_KEY = 'sre_dashboard_state_airs_v5'; // Key for local persistence
const THEME_STORAGE_KEY = 'sre_dashboard_theme_v5';
const API_BASE = 'http://localhost:5000/api';

// API Service layer
const apiService = {
  async getServices() {
    const response = await fetch(`${API_BASE}/services`);
    if (!response.ok) throw new Error('Failed to fetch services');
    return response.json();
  },

  async getServiceMetrics(serviceId) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/metrics`);
    if (!response.ok) throw new Error(`Failed to fetch metrics for ${serviceId}`);
    return response.json();
  },

  async getLogAnalysis(serviceId) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/logs/analysis`);
    if (!response.ok) throw new Error(`Failed to fetch logs for ${serviceId}`);
    return response.json();
  },

  async simulateLoad(serviceId, intensity = 'medium') {
    const response = await fetch(`${API_BASE}/services/${serviceId}/simulate-load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intensity })
    });
    if (!response.ok) throw new Error('Failed to simulate load');
    return response.json();
  },

  async remediateService(serviceId, action, reason) {
    const response = await fetch(`${API_BASE}/services/${serviceId}/remediate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason })
    });
    if (!response.ok) throw new Error('Remediation failed');
    return response.json();
  },

  async getHealth() {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  },

  async resetServices() {
    const response = await fetch(`${API_BASE}/services/reset`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Reset failed');
    return response.json();
  }
};

// Map backend status to frontend status format
const mapBackendStatus = (backendStatus) => {
  if (!backendStatus) return 'HEALTHY';
  return backendStatus.toUpperCase();
};

// Map backend metrics to frontend format
const mapBackendServiceToFrontend = (backendService, existingService = null) => {
  // Determine primary metric and value based on worst performing metric
  const metrics = backendService.metrics || {};
  let primaryMetric = 'CPU_Load';
  let primaryValue = metrics.cpu || 0;
  
  // Find the worst metric to display
  if (metrics.error_rate > primaryValue) {
    primaryMetric = 'Error_Rate';
    primaryValue = metrics.error_rate;
  }
  if (metrics.memory > primaryValue) {
    primaryMetric = 'Memory_Use';
    primaryValue = metrics.memory;
  }
  if (metrics.latency > primaryValue / 10) { // Scale latency for comparison
    primaryMetric = 'Latency_ms';
    primaryValue = metrics.latency;
  }

  const status = mapBackendStatus(backendService.status);
  
  // Preserve history if service exists, otherwise initialize
  const history = existingService?.history || Array(MAX_HISTORY).fill(primaryValue);
  
  // Update history with new value
  const newHistory = [...history.slice(1), parseFloat(primaryValue.toFixed(1))];
  
  // Generate alert_id based on status
  const alert_id = status === 'CRITICAL' ? `ALERT-${backendService.id.slice(1)}` : 
                   status === 'WARNING' ? `WARN-${backendService.id.slice(1)}` : null;

  return {
    id: backendService.id,
    name: backendService.name,
    status: backendService.remediationInProgress ? 'REMEDIATING' : status,
    metric: primaryMetric,
    value: parseFloat(primaryValue.toFixed(1)),
    history: newHistory,
    alert_id,
    // Backend data for reference
    _backendData: backendService
  };
};

// Map backend logs to frontend format
const mapBackendLogToFrontend = (backendLog, service) => {
  let type = 'INFO';
  let message = backendLog.message;

  // Determine log type based on level and content
  if (backendLog.level === 'ERROR') {
    type = service.status === 'CRITICAL' ? 'AGENT_TRIGGERED' : 'WARNING';
  } else if (backendLog.level === 'WARN') {
    type = 'WARNING';
  }

  // Enhance message for critical incidents
  if (backendLog.level === 'ERROR' && service.status === 'CRITICAL') {
    message = `Incident Detected: ${service.name} entered CRITICAL state. **AIRS Agent Triage Initiated.**`;
  }

  return {
    id: backendLog.trace_id || Date.now() + Math.random(),
    timestamp: backendLog.timestamp,
    type,
    serviceName: service.name,
    metric: service.metric,
    value: service.value,
    message,
  };
};

const METRIC_UNITS = {
    'CPU_Load': '%',
    'Memory_Use': '%',
    'Latency_ms': 'ms',
    'Error_Rate': '%',
    'Disk_IO_Wait': 's',
};

// Thresholds for CRITICAL and WARNING states
const THRESHOLDS = {
    'CPU_Load': { warn: 65, crit: 85 },
    'Memory_Use': { warn: 70, crit: 90 },
    'Latency_ms': { warn: 500, crit: 800 },
    'Error_Rate': { warn: 10, crit: 20 },
    'Disk_IO_Wait': { warn: 15, crit: 25 },
};

const STATUS_CLASSES = {
    'HEALTHY': 'status-healthy',
    'WARNING': 'status-warning',
    'CRITICAL': 'status-critical',
    'REMEDIATING': 'status-remediating',
};

const STATUS_COLORS = {
    'HEALTHY': '#10b981', // green-500
    'WARNING': '#f59e0b', // yellow-500
    'CRITICAL': '#ef4444', // red-500
    'REMEDIATING': '#3b82f6', // blue-500
    'AGENT_SUCCESS': '#22c55e', // emerald-500
    'AGENT_TRIGGERED': '#ef4444', // red-500
    'MANUAL_OVERRIDE': '#a855f7', // purple-500
};

// --- LOGGING UTILITY ---

/**
 * Creates a structured log entry for the audit timeline, focusing on Agent actions.
 */
const createLog = (type, service) => {
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
        type: type, // 'AGENT_TRIGGERED', 'AGENT_SUCCESS', 'WARNING', 'MANUAL_OVERRIDE'
        serviceName: service.name,
        metric: service.metric,
        value: service.value,
        message: message,
    };
};

// --- REACT COMPONENTS ---

const Sparkline = React.memo(({ data, color }) => {
    const canvasRef = useRef(null);

    // Function to handle canvas redraw on mount and resize
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const container = canvas.parentElement;
        if (container) {
             canvas.width = container.offsetWidth;
             canvas.height = container.offsetHeight;
        } else {
             canvas.width = 300;
             canvas.height = 40;
        }

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        if (data.length === 0) return;

        // Find min/max for scaling
        const minVal = Math.min(...data);
        const maxVal = Math.max(...data);
        const range = maxVal - minVal;
        const scaleY = (y) => height - ((y - minVal) / (range > 0 ? range : 1)) * height;
        const scaleX = (x) => (x / (data.length - 1)) * width;

        // Draw the line
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';

        data.forEach((value, index) => {
            if (index === 0) {
                ctx.moveTo(scaleX(index), scaleY(value));
            } else {
                ctx.lineTo(scaleX(index), scaleY(value));
            }
        });

        ctx.stroke();
    }, [data, color]);

    useEffect(() => {
        let resizeTimer;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(draw, 100);
        };
        
        draw();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [data, color, draw]);

    return <canvas ref={canvasRef} className="sparkline-canvas" style={{ width: '100%', height: '100%' }} />;
});


// --- Doughnut Chart for Overall Health ---
const CHART_SIZE = 150;
const CHART_RADIUS = 60;
const CHART_STROKE = 25;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;

const DoughnutChart = React.memo(({ counts, totalServices }) => {
    if (totalServices === 0) {
        return <div className="chart-placeholder">No Services</div>;
    }

    // Define the order for drawing the segments (Critical first, then Warning, etc.)
    const healthData = [
        { status: 'CRITICAL', value: counts.critical, color: STATUS_COLORS['CRITICAL'], label: 'Critical' },
        { status: 'WARNING', value: counts.warning, color: STATUS_COLORS['WARNING'], label: 'Warning' },
        { status: 'REMEDIATING', value: counts.remediating, color: STATUS_COLORS['REMEDIATING'], label: 'Remediating' },
        { status: 'HEALTHY', value: counts.healthy, color: STATUS_COLORS['HEALTHY'], label: 'Healthy' },
    ].filter(item => item.value > 0);

    let cumulativePercent = 0;
    
    // Calculate SVG stroke attributes for each segment
    const segments = healthData.map(item => {
        const percent = item.value / totalServices;
        const dashArray = percent * CHART_CIRCUMFERENCE;
        const dashOffset = cumulativePercent * CHART_CIRCUMFERENCE;
        
        cumulativePercent += percent;

        return {
            ...item,
            dashArray: dashArray,
            dashOffset: -dashOffset,
        };
    });

    return (
        <div className="doughnut-chart-widget">
            <h3 className="chart-title">Overall System Health</h3>
            <div className="chart-inner-content">
                <svg
                    viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
                    width={CHART_SIZE}
                    height={CHART_SIZE}
                    className="doughnut-svg"
                >
                    <g transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}>
                        {/* Background track */}
                        <circle
                            cx={CHART_SIZE / 2}
                            cy={CHART_SIZE / 2}
                            r={CHART_RADIUS}
                            fill="transparent"
                            stroke="var(--bg-light)"
                            strokeWidth={CHART_STROKE}
                        />

                        {/* Data segments */}
                        {segments.map((segment, index) => (
                            <circle
                                key={segment.status}
                                cx={CHART_SIZE / 2}
                                cy={CHART_SIZE / 2}
                                r={CHART_RADIUS}
                                fill="transparent"
                                stroke={segment.color}
                                strokeWidth={CHART_STROKE}
                                strokeDasharray={`${segment.dashArray} ${CHART_CIRCUMFERENCE - segment.dashArray}`}
                                strokeDashoffset={segment.dashOffset}
                                style={{ transition: 'stroke-dasharray 0.5s ease-out, stroke-dashoffset 0.5s ease-out' }}
                            />
                        ))}
                    </g>
                    {/* Center Text (Total Services) */}
                    <text 
                        x="50%" 
                        y="50%" 
                        dominantBaseline="middle" 
                        textAnchor="middle" 
                        className="chart-center-text-total"
                    >
                        {totalServices}
                    </text>
                    <text 
                        x="50%" 
                        y="65%" 
                        dominantBaseline="middle" 
                        textAnchor="middle" 
                        className="chart-center-text-label"
                    >
                        Services
                    </text>
                </svg>
                
                {/* Legend */}
                <div className="chart-legend">
                    {healthData.map(item => (
                        <div key={item.status} className="legend-item">
                            <span className="legend-color" style={{ backgroundColor: item.color }}></span>
                            <span className="legend-label">{item.label}</span>
                            <span className="legend-value" style={{ color: item.color }}>{item.value} ({((item.value / totalServices) * 100).toFixed(0)}%)</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});


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

    const handleRemediate = () => {
        if (status !== 'REMEDIATING') {
            startRemediation(service.id, service, true);
        }
    };

    const StatusIcon = useMemo(() => {
        if (status === 'REMEDIATING') return RefreshCw;
        if (status === 'HEALTHY') return CheckCircle;
        return XCircle;
    }, [status]);

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
                    {alert_id && <div className="alert-id" style={{ color: statusColor }}>Alert: {alert_id}</div>}
                </div>
            </div>

            <div className="sparkline-container">
                <Sparkline data={history} color={statusColor} />
            </div>

            <div className="card-footer">
                <div className={`agent-info ${status === 'REMEDIATING' ? 'agent-remediating' : ''}`}>
                     <HardHat size={16} />
                     <span>{status === 'REMEDIATING' ? 'Agent (AIRS) is Working' : 'Agent (AIRS) Monitoring'}</span>
                </div>

                <button
                    onClick={handleRemediate}
                    disabled={status === 'HEALTHY' || status === 'REMEDIATING'}
                    className={`remediate-btn ${status === 'HEALTHY' || status === 'REMEDIATING' ? 'remediate-btn-disabled' : 'remediate-btn-enabled'}`}
                >
                    <StatusIcon size={18} className={`mr-2 ${status === 'REMEDIATING' ? 'animate-spin' : ''}`} />
                    {status === 'REMEDIATING' ? 'Agent Action...' : 'Manual Override'}
                </button>
            </div>
        </div>
    );
});


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
                    <span className="log-type" style={{ backgroundColor: color, color: 'var(--bg-dark)' }}>{log.type.replace('_', ' ')}</span>
                </div>
            </div>
        </div>
    );
};


const ServiceCatalogView = ({ services }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

    const sortedServices = useMemo(() => {
        if (!services) return [];
        let sortableItems = [...services];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [services, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (
            sortConfig &&
            sortConfig.key === key &&
            sortConfig.direction === 'ascending'
        ) {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'ascending' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };
    
    // Fallback/Loading UI
    if (!services || services.length === 0) {
        return (
            <div className="placeholder-container">
                <div className="placeholder-content">
                    <Server size={48} className="placeholder-icon" />
                    <h2 className="placeholder-title">No Services Registered</h2>
                    <p className="placeholder-text">The service catalog is currently empty. Check configuration settings.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="catalog-container">
            <h1 className="main-title">Service Catalog & Management</h1>
            <p className="text-secondary">A comprehensive list of all monitored microservices, their current status, and performance metrics.</p>

            <div className="table-responsive">
                <table className="service-table">
                    <thead>
                        <tr>
                            {['id', 'name', 'status', 'metric', 'value', 'alert_id'].map(key => (
                                <th key={key}>
                                    <button className="sort-header" onClick={() => requestSort(key)}>
                                        {key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                                        {getSortIcon(key)}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedServices.map(service => (
                            <tr key={service.id}>
                                <td>{service.id}</td>
                                <td>{service.name}</td>
                                <td>
                                    <span className={`status-pill ${STATUS_CLASSES[service.status]}`}>
                                        {service.status.toUpperCase()}
                                    </span>
                                </td>
                                <td>{service.metric}</td>
                                <td>{service.value}{METRIC_UNITS[service.metric]}</td>
                                <td>
                                    {service.alert_id ? (
                                        <span className={`alert-indicator ${service.status === 'CRITICAL' ? 'critical-indicator' : 'warning-indicator'}`}>
                                            {service.alert_id}
                                        </span>
                                    ) : 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Legend/Info Section */}
            <div className="info-box">
                <h3 className="info-title"><Search size={18} style={{marginRight: '0.5rem'}} />Monitoring Details</h3>
                <p>The AIRS agent continuously tracks the listed services. Critical (CRITICAL) and Warning (WARNING) states trigger automated remediation, visible as REMEDIATING.</p>
            </div>
        </div>
    );
};


const MainDashboardView = ({ services, logs, startRemediation, backendStatus }) => {
    const [selectedTab, setSelectedTab] = useState('Critical');

    if (!services || !logs) {
         return (
            <div className="placeholder-container">
                <div className="placeholder-content">
                    <RefreshCw size={48} className="placeholder-icon animate-spin" />
                    <h2 className="placeholder-title">Loading Dashboard Data...</h2>
                    <p className="placeholder-text">Initializing local state from storage.</p>
                </div>
            </div>
        );
    }

    // Backend connection status banner
    if (backendStatus === 'disconnected') {
        return (
            <div className="dashboard-grid-container">
                <div className="backend-error-banner">
                    ⚠️ Backend server is unavailable. Showing last known state. Please ensure the backend is running on port 5000.
                </div>
                
                {/* Show cached data when backend is down */}
                <h1 className="main-title">AIRS Agent Operations Dashboard</h1>
                
                {/* Health counts from cached data */}
                const healthCounts = useMemo(() => ({
                    critical: services.filter(s => s.status === 'CRITICAL').length,
                    warning: services.filter(s => s.status === 'WARNING').length,
                    remediating: services.filter(s => s.status === 'REMEDIATING').length,
                    healthy: services.filter(s => s.status === 'HEALTHY').length,
                }), [services]);

                {/* Rest of your existing dashboard code for cached data */}
                {/* ... */}
            </div>
        );
    }

    // Use raw status counts for the Doughnut Chart
    const healthCounts = useMemo(() => ({
        critical: services.filter(s => s.status === 'CRITICAL').length,
        warning: services.filter(s => s.status === 'WARNING').length,
        remediating: services.filter(s => s.status === 'REMEDIATING').length,
        healthy: services.filter(s => s.status === 'HEALTHY').length,
    }), [services]);
    
    // Use the potentially complex counting for the existing stats grid (for comparison/continuity)
    const criticalCount = services.filter(s => s.status === 'CRITICAL' || (s.status === 'REMEDIATING' && s.alert_id && s.alert_id.startsWith('ALERT'))).length;
    const warningCount = services.filter(s => s.status === 'WARNING' || (s.status === 'REMEDIATING' && s.alert_id && s.alert_id.startsWith('WARN'))).length;
    const remediatingCount = healthCounts.remediating;


    // Sort logs by timestamp (newest first)
    const sortedLogs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Filter logs for the Critical Timeline (Agent-related actions)
    const criticalTimeline = sortedLogs.filter(log =>
        log.type === 'AGENT_TRIGGERED' ||
        log.type === 'AGENT_SUCCESS' ||
        log.type === 'MANUAL_OVERRIDE'
    );
    // General Timeline includes everything
    const generalTimeline = sortedLogs;

    const currentTimeline = selectedTab === 'Critical' ? criticalTimeline : generalTimeline;


    return (
        <div className="dashboard-grid-container">
            <h1 className="main-title">AIRS Agent Operations Dashboard</h1>

            {/* Combined Summary Section (Chart + Numerical Stats) */}
            <div className="top-dashboard-summary">
                {/* 1. Overall Health Doughnut Chart */}
                <div className="summary-chart-container">
                    <DoughnutChart counts={healthCounts} totalServices={services.length} />
                </div>
                
                {/* 2. Overview Stats (Numerical) */}
                <div className="stats-grid">
                    <div className="stat-card stat-healthy">
                        <Zap size={24} />
                        <div className="stat-value">{services.length}</div>
                        <div className="stat-label">Total Services</div>
                    </div>
                     <div className="stat-card stat-remediating">
                        <HardHat size={24} />
                        <div className="stat-value">{remediatingCount}</div>
                        <div className="stat-label">Agent Remediating</div>
                    </div>
                    <div className="stat-card stat-critical">
                        <XCircle size={24} />
                        <div className="stat-value">{criticalCount}</div>
                        <div className="stat-label">Critical Alerts</div>
                    </div>
                    <div className="stat-card stat-warning">
                        <AlertTriangle size={24} />
                        <div className="stat-value">{warningCount}</div>
                        <div className="stat-label">Warning States</div>
                    </div>
                </div>
            </div>

            {/* Service Cards Grid */}
            <div className="section-title-bar">
                 <h2 className="section-title">Microservice Health Status</h2>
            </div>
            <div className="service-cards-grid">
                {services.map(service => (
                    <ServiceCard
                        key={service.id}
                        service={service}
                        startRemediation={startRemediation}
                    />
                ))}
            </div>

            {/* Logs Audit Timeline */}
            <div className="logs-container">
                <div className="section-title-bar">
                    <h2 className="section-title">AIRS Agent Audit Timeline (Groq/Langflow Actions)</h2>
                </div>

                <div className="tabs-container">
                    <button
                        onClick={() => setSelectedTab('Critical')}
                        className={`tab-btn ${selectedTab === 'Critical' ? 'tab-active' : ''}`}
                    >
                        Critical Incidents ({criticalTimeline.length})
                    </button>
                    <button
                        onClick={() => setSelectedTab('General')}
                        className={`tab-btn ${selectedTab === 'General' ? 'tab-active' : ''}`}
                    >
                        General System Logs ({generalTimeline.length})
                    </button>
                </div>

                <div className="timeline-view">
                    {currentTimeline.length === 0 ? (
                        <p className="text-secondary text-center p-8">No recent audit logs for this timeline. Agent is idle.</p>
                    ) : (
                        currentTimeline.map(log => <LogItem key={log.id} log={log} />)
                    )}
                </div>
            </div>
        </div>
    );
};


// A simple placeholder view for the secondary routes
const PlaceholderView = ({ title, icon: Icon }) => (
    <div className="placeholder-container">
        <div className="placeholder-content">
            <Icon size={48} className="placeholder-icon" />
            <h2 className="placeholder-title">{title}</h2>
            <p className="placeholder-text">This view is coming soon.</p>
        </div>
    </div>
);


// --- MAIN APP COMPONENT ---

const App = () => {
    // Determine initial sidebar state based on screen size (default expanded on desktop)
    const getInitialSidebarState = () => window.innerWidth >= 1024;
    
    // 1. THEME LOGIC
    const getInitialTheme = () => {
        try {
            return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
        } catch (e) {
            return 'dark';
        }
    };
    const [theme, setTheme] = useState(getInitialTheme);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(getInitialSidebarState);
    const [showSidebarMobile, setShowSidebarMobile] = useState(false); // Only for mobile overlay
    const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'connected', 'disconnected'
    
    // Save theme preference whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (e) {
            console.error("Error writing theme to localStorage:", e);
        }
    }, [theme]);
    
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    // 2. DASHBOARD DATA LOGIC
    const getInitialState = () => {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                const parsed = JSON.parse(storedData);
                if (parsed.services && Array.isArray(parsed.services) && parsed.services.length > 0 && parsed.services[0].id) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Error reading from localStorage:", e);
        }
        return { services: [], logs: [] };
    };

    const [dashboardData, setDashboardData] = useState(getInitialState); // { services: [], logs: [] }
    const services = dashboardData?.services;
    const logs = dashboardData?.logs;

    const [currentView, setCurrentView] = useState('Dashboard');
    
    const userId = "HACKATHON-USER-A"; 

    // Fetch services from backend
    const fetchServices = async () => {
        try {
            const backendServices = await apiService.getServices();
            setBackendStatus('connected');
            
            setDashboardData(prevData => {
                if (!prevData) return { services: [], logs: [] };

                // Map backend services to frontend format, preserving history
                const updatedServices = backendServices.map(backendService => {
                    const existingService = prevData.services.find(s => s.id === backendService.id);
                    return mapBackendServiceToFrontend(backendService, existingService);
                });

                // Collect logs from all services
                const serviceLogs = [];
                for (const backendService of backendServices) {
                    try {
                        const metricsData = await apiService.getServiceMetrics(backendService.id);
                        if (metricsData.logs) {
                            const frontendService = updatedServices.find(s => s.id === backendService.id);
                            const mappedLogs = metricsData.logs.map(log => 
                                mapBackendLogToFrontend(log, frontendService)
                            );
                            serviceLogs.push(...mappedLogs);
                        }
                    } catch (err) {
                        console.error(`Failed to fetch logs for ${backendService.id}:`, err);
                    }
                }

                // Combine with existing logs and limit to MAX_LOGS
                const allLogs = [...serviceLogs, ...prevData.logs]
                    .filter((log, index, self) => 
                        index === self.findIndex(l => l.id === log.id)
                    )
                    .slice(0, MAX_LOGS);

                return { services: updatedServices, logs: allLogs };
            });
        } catch (err) {
            console.error('Failed to fetch services from backend:', err);
            setBackendStatus('disconnected');
            // Keep existing data when backend is down
        }
    };

    // --- LOCAL STORAGE PERSISTENCE EFFECT ---
    useEffect(() => {
        if (dashboardData && dashboardData.services && dashboardData.logs) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dashboardData));
            } catch (e) {
                console.error("Error writing to localStorage:", e);
            }
        }
    }, [dashboardData]);

    // --- BACKEND DATA POLLING ---
    useEffect(() => {
        fetchServices(); // Initial fetch
        
        const interval = setInterval(fetchServices, SIMULATION_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    // --- AGENT/REMEDIATION FUNCTION (Calls backend API) ---
    const startRemediation = useCallback(async (id, currentService, isManual = false) => {
        if (!services) {
            console.error("Services data not ready for remediation.");
            return;
        }

        const logType = isManual ? 'MANUAL_OVERRIDE' : 'AGENT_TRIGGERED';

        try {
            // Call backend remediation API
            const result = await apiService.remediateService(id, 'restart_service', 
                isManual ? 'Manual remediation triggered by user' : 'Automatic remediation by AIRS agent'
            );

            // Update local state to show remediating status
            setDashboardData(prevData => {
                if (!prevData) return null;

                const remediatingServices = prevData.services.map(s => 
                    s.id === id ? { ...s, status: 'REMEDIATING' } : s
                );
                
                const serviceToLog = remediatingServices.find(s => s.id === id) || currentService;
                const remediationLog = createLog(logType, serviceToLog);
                const updatedLogs = [remediationLog, ...prevData.logs].slice(0, MAX_LOGS);

                return { services: remediatingServices, logs: updatedLogs };
            });

            // The backend will handle the actual remediation and we'll see the result in the next poll

        } catch (err) {
            console.error('Remediation failed:', err);
            // Add error log
            setDashboardData(prevData => {
                if (!prevData) return null;
                
                const errorLog = {
                    id: Date.now() + Math.random(),
                    timestamp: new Date().toISOString(),
                    type: 'WARNING',
                    serviceName: currentService.name,
                    metric: currentService.metric,
                    value: currentService.value,
                    message: `Remediation failed: ${err.message}`,
                };
                
                const updatedLogs = [errorLog, ...prevData.logs].slice(0, MAX_LOGS);
                return { ...prevData, logs: updatedLogs };
            });
        }
    }, [services]); 

    // --- RENDERING LOGIC ---

    const renderSidebar = () => (
        <div className={`app-sidebar ${isSidebarExpanded ? 'is-expanded' : 'is-collapsed'} ${showSidebarMobile ? 'sidebar-open-mobile' : 'sidebar-closed-mobile'}`}>
            <div className={`sidebar-header ${isSidebarExpanded ? '' : 'justify-center'}`}>
                <div className="sidebar-logo">
                    <Activity size={32} />
                    {isSidebarExpanded && <span className="sidebar-logo-text">AIRS Agent</span>}
                </div>
                {/* Desktop Collapse Toggle */}
                <button
                    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                    className={`collapse-toggle-desktop icon-btn ${isSidebarExpanded ? '' : 'rotate-180'}`}
                    title={isSidebarExpanded ? 'Collapse Menu' : 'Expand Menu'}
                >
                    <ChevronLeft size={20} />
                </button>
            </div>

            <nav className="sidebar-nav">
                {[
                    { name: 'Dashboard', icon: LayoutDashboard },
                    { name: 'Services', icon: Server },
                    { name: 'Team', icon: Users },
                    { name: 'Settings', icon: Settings },
                ].map(({ name, icon: Icon }) => (
                    <button
                        key={name}
                        onClick={() => { setCurrentView(name); setShowSidebarMobile(false); }}
                        className={`sidebar-nav-item ${currentView === name ? 'nav-item-active' : ''} ${isSidebarExpanded ? '' : 'justify-center'}`}
                        title={name}
                    >
                        <Icon size={24} className="nav-icon" />
                        {isSidebarExpanded && <span className="nav-text">{name}</span>}
                    </button>
                ))}
            </nav>
        </div>
    );

    const renderView = () => {
        switch (currentView) {
            case 'Dashboard':
                return <MainDashboardView services={services} logs={logs} startRemediation={startRemediation} backendStatus={backendStatus} />;
            case 'Services':
                return <ServiceCatalogView services={services} />;
            case 'Team':
                return <PlaceholderView title="Team Directory" icon={Users} />;
            case 'Settings':
                return <PlaceholderView title="Agent Configuration" icon={Settings} />;
            default:
                return <MainDashboardView services={services} logs={logs} startRemediation={startRemediation} backendStatus={backendStatus} />;
        }
    };

    const ThemeIcon = theme === 'dark' ? Sun : Moon;

    const desktopMarginLeft = isSidebarExpanded ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)';

    return (
        <>
            {/* Pure CSS Styles - All inline for single file mandate */}

            <div className={`app-container ${theme}-mode`}>
                {/* Header */}
                <header className="app-header">
                    <div className="flex-start">
                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setShowSidebarMobile(!showSidebarMobile)}
                            className="icon-btn menu-toggle-mobile"
                            style={{ display: window.innerWidth < 1024 ? 'block' : 'none' }}
                        >
                            <Menu size={24} className="text-white" />
                        </button>

                        <div className="header-title">
                            <Zap size={24} style={{ marginRight: '0.5rem' }} />
                            AIRS Dashboard
                            <span className={`backend-status ${backendStatus}`}>
                                {backendStatus === 'connected' ? '✅ Connected' : 
                                 backendStatus === 'disconnected' ? '❌ Backend Offline' : '⏳ Connecting...'}
                            </span>
                        </div>
                    </div>

                    <div className="flex-end">
                        {/* Theme Toggle Button */}
                        <button onClick={toggleTheme} className="icon-btn" title="Toggle Theme">
                            <ThemeIcon size={20} />
                        </button>
                        
                        {/* Notification Bell */}
                        <div className="notification-container">
                            <button className="icon-btn" title="Notifications">
                                <Bell size={20} />
                            </button>
                            {/* Simple ping indicating a new critical alert */}
                            {services && services.some(s => s.status === 'CRITICAL' || s.status === 'REMEDIATING') && <span className="notification-ping"></span>}
                        </div>

                        {/* User Badge */}
                        <div className="user-badge">
                            <User size={20} className="icon" />
                            <span className="text" title={`Current User ID: ${userId}`} style={{ display: window.innerWidth >= 768 ? 'block' : 'none' }}>
                                {`User: ${userId}`}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Main Layout */}
                <div className="app-layout">
                    {/* Sidebar Overlay for Mobile */}
                    {showSidebarMobile && window.innerWidth < 1024 && (
                        <div
                            onClick={() => setShowSidebarMobile(false)}
                            className="mobile-overlay"
                        />
                    )}

                    {/* Sidebar */}
                    {renderSidebar()}

                    {/* Main Content Area Wrapper (Handles Offset) */}
                    <div 
                        className={`main-content-wrapper ${isSidebarExpanded ? '' : 'collapsed'}`}
                        style={{
                            marginLeft: window.innerWidth >= 1024 ? desktopMarginLeft : '0',
                        }}
                    >
                        {/* Actual Content Container (Handles Centering) */}
                        <main className="app-main-content">
                            {renderView()}
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
};

export default App;