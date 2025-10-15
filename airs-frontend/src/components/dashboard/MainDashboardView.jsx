import React, { useState, useMemo } from 'react';
import { Zap, HardHat, XCircle, AlertTriangle } from 'lucide-react';
import ServiceCard from './ServiceCard';
import LogItem from './LogItem';
import DoughnutChart from '../charts/DoughnutChart';

const MainDashboardView = ({ services, logs, startRemediation }) => {
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

  // Use raw status counts for the Doughnut Chart
  const healthCounts = useMemo(() => ({
    critical: services.filter(s => s.status === 'CRITICAL').length,
    warning: services.filter(s => s.status === 'WARNING').length,
    remediating: services.filter(s => s.status === 'REMEDIATING').length,
    healthy: services.filter(s => s.status === 'HEALTHY').length,
  }), [services]);
  
  // Use the potentially complex counting for the existing stats grid
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

export default MainDashboardView;