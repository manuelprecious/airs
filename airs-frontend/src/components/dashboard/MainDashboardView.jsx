import React, { useState, useMemo } from "react";
import {
  Zap,
  HardHat,
  XCircle,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Server,
  Brain,
  Eye,
  Cpu,
  Activity,
  CheckCircle,
  AlertOctagon,
} from "lucide-react";
import ServiceCard from "./ServiceCard";
import LogItem from "./LogItem";
import DoughnutChart from "../charts/DoughnutChart";

const MainDashboardView = ({
  services,
  logs,
  startRemediation,
  isLoading,
  error,
  refreshData,
}) => {
  const [selectedTab, setSelectedTab] = useState("Critical");
  const [aiSystemStatus] = useState({
    agentsActive: true,
    watchmanRunning: true,
    lastHeartbeat: new Date().toISOString(),
    activeRemediations: 0,
    totalRemediations: 12,
    successRate: "92%",
    systemLoad: "Low"
  });

  // Move ALL hooks to the top - they must be called in the same order every render
  const healthCounts = useMemo(() => {
    if (!services || services.length === 0) {
      return { critical: 0, warning: 0, remediating: 0, healthy: 0 };
    }
    return {
      critical: services.filter((s) => s.status === "CRITICAL").length,
      warning: services.filter((s) => s.status === "WARNING").length,
      remediating: services.filter((s) => s.status === "REMEDIATING").length,
      healthy: services.filter((s) => s.status === "HEALTHY").length,
    };
  }, [services]);

  const criticalCount = useMemo(() => healthCounts.critical, [healthCounts]);
  const warningCount = useMemo(() => healthCounts.warning, [healthCounts]);
  const remediatingCount = useMemo(
    () => healthCounts.remediating,
    [healthCounts]
  );

  const sortedLogs = useMemo(() => {
    if (!logs) return [];
    return [...logs].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  }, [logs]);

  const criticalTimeline = useMemo(
    () =>
      sortedLogs.filter(
        (log) =>
          log.type === "AGENT_TRIGGERED" ||
          log.type === "AGENT_SUCCESS" ||
          log.type === "MANUAL_OVERRIDE"
      ),
    [sortedLogs]
  );

  const generalTimeline = useMemo(() => sortedLogs, [sortedLogs]);
  const currentTimeline = useMemo(
    () => (selectedTab === "Critical" ? criticalTimeline : generalTimeline),
    [selectedTab, criticalTimeline, generalTimeline]
  );

  // Calculate active remediations for AI status
  const activeRemediations = useMemo(() => {
    return services.filter(s => s.status === 'REMEDIATING').length;
  }, [services]);

  // Now do conditional rendering AFTER all hooks
  if (isLoading) {
    return (
      <div className="placeholder-container">
        <div className="placeholder-content">
          <RefreshCw size={48} className="placeholder-icon animate-spin" />
          <h2 className="placeholder-title">Loading Dashboard</h2>
          <p className="placeholder-text">Connecting to backend services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="placeholder-container">
        <div className="placeholder-content">
          <AlertCircle size={48} className="placeholder-icon text-red-500" />
          <h2 className="placeholder-title">Connection Error</h2>
          <p className="placeholder-text">{error}</p>
          <button
            onClick={refreshData}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="placeholder-container">
        <div className="placeholder-content">
          <Server size={48} className="placeholder-icon" />
          <h2 className="placeholder-title">No Services</h2>
          <p className="placeholder-text">
            No services found in the backend system.
          </p>
          <button
            onClick={refreshData}
            className="refresh-data-btn"
            title="Refresh data from backend"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            Refresh Data
          </button>
        </div>
      </div>
    );
  }

  // Main render - all hooks have been called consistently
  return (
    <div className="dashboard-grid-container">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="main-title">AIRS Agent Operations Dashboard</h1>
        <button
          onClick={refreshData}
          className="refresh-data-btn"
          title="Refresh data from backend"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          Refresh Data
        </button>
      </div>

      {/* THREE COLUMN LAYOUT: Big Card | 2x2 Grid | Big Card */}
      <div className="three-column-layout">
        {/* LEFT: Overall System Health (Big Card) */}
        <div className="big-card-container">
          <DoughnutChart
            counts={healthCounts}
            totalServices={services.length}
          />
        </div>

        {/* MIDDLE: 2x2 Grid of Stat Cards */}
        <div className="stats-grid-2x2-middle">
          <div className="stat-card-middle stat-healthy">
            <Zap size={28} />
            <div className="stat-value-middle">{services.length}</div>
            <div className="stat-label-middle">Total Services</div>
          </div>
          <div className="stat-card-middle stat-remediating">
            <HardHat size={28} />
            <div className="stat-value-middle">{remediatingCount}</div>
            <div className="stat-label-middle">Remediating</div>
          </div>
          <div className="stat-card-middle stat-critical">
            <XCircle size={28} />
            <div className="stat-value-middle">{criticalCount}</div>
            <div className="stat-label-middle">Critical</div>
          </div>
          <div className="stat-card-middle stat-warning">
            <AlertTriangle size={28} />
            <div className="stat-value-middle">{warningCount}</div>
            <div className="stat-label-middle">Warnings</div>
          </div>
        </div>

        {/* RIGHT: AI Agents & Watchman Service (Big Card) */}
        <div className="big-card-container">
          <div className={`ai-watchman-card ${aiSystemStatus.agentsActive ? 'active' : ''}`}>
            <div className="ai-watchman-header">
              <div className="ai-watchman-title-section">
                <Brain size={32} className="ai-watchman-main-icon" />
                <div>
                  <h3 className="ai-watchman-title">AI Agents & Watchman</h3>
                  <p className="ai-watchman-subtitle">Automated Remediation System</p>
                </div>
              </div>
              <div className={`status-badge ${aiSystemStatus.agentsActive ? 'status-active' : 'status-inactive'}`}>
                {aiSystemStatus.agentsActive ? (
                  <CheckCircle size={16} />
                ) : (
                  <AlertOctagon size={16} />
                )}
                <span>{aiSystemStatus.agentsActive ? 'ACTIVE' : 'INACTIVE'}</span>
              </div>
            </div>

            <div className="ai-watchman-content">
              <div className="ai-metrics-grid">
                <div className="ai-metric-item">
                  <div className="ai-metric-value">{aiSystemStatus.totalRemediations}</div>
                  <div className="ai-metric-label">Total Fixes</div>
                </div>
                <div className="ai-metric-item">
                  <div className="ai-metric-value">{aiSystemStatus.successRate}</div>
                  <div className="ai-metric-label">Success Rate</div>
                </div>
                <div className="ai-metric-item">
                  <div className="ai-metric-value">{activeRemediations}</div>
                  <div className="ai-metric-label">Active Now</div>
                </div>
                <div className="ai-metric-item">
                  <div className="ai-metric-value">{aiSystemStatus.systemLoad}</div>
                  <div className="ai-metric-label">System Load</div>
                </div>
              </div>

              <div className="watchman-status-section">
                <div className="watchman-status-header">
                  <Eye size={20} className="watchman-icon" />
                  <span>Watchman Service</span>
                </div>
                <div className="watchman-status-details">
                  <div className={`watchman-status ${aiSystemStatus.watchmanRunning ? 'running' : 'stopped'}`}>
                    <div className="status-indicator"></div>
                    <span>{aiSystemStatus.watchmanRunning ? 'Running' : 'Stopped'}</span>
                  </div>
                  <div className="watchman-uptime">
                    <Cpu size={14} />
                    <span>Last: {new Date(aiSystemStatus.lastHeartbeat).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ai-watchman-footer">
              <div className="ai-activity">
                <Activity size={16} />
                <span>All systems operational</span>
              </div>
              <div className="ai-version">v2.1.0</div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="section-title-bar">
        <h2 className="section-title">Service Health Status</h2>
        <span className="text-sm text-secondary">
          Live from backend • {new Date().toLocaleTimeString()}
        </span>
      </div>

      <div className="service-cards-grid">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            startRemediation={startRemediation}
          />
        ))}
      </div>

      {/* Audit Logs */}
      <div className="logs-container">
        <div className="section-title-bar">
          <h2 className="section-title">System Audit Log</h2>
        </div>

        <div className="tabs-container">
          <button
            onClick={() => setSelectedTab("Critical")}
            className={`tab-btn ${
              selectedTab === "Critical" ? "tab-active" : ""
            }`}
          >
            Critical Events ({criticalTimeline.length})
          </button>
          <button
            onClick={() => setSelectedTab("General")}
            className={`tab-btn ${
              selectedTab === "General" ? "tab-active" : ""
            }`}
          >
            All Logs ({generalTimeline.length})
          </button>
        </div>

        <div className="timeline-view">
          {currentTimeline.length === 0 ? (
            <p className="text-secondary text-center p-8">
              {selectedTab === "Critical"
                ? "No critical events"
                : "No system logs"}
            </p>
          ) : (
            currentTimeline.map((log) => <LogItem key={log.id} log={log} />)
          )}
        </div>
      </div>
    </div>
  );
};

export default MainDashboardView;