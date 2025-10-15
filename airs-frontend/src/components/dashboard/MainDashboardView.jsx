import React, { useState, useMemo } from "react";
import {
  Zap,
  HardHat,
  XCircle,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Server,
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
            className="refresh-data-btn" // Add this class
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
          className="refresh-data-btn" // Add this class
          title="Refresh data from backend"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          Refresh Data
        </button>
      </div>

      {/* Health Overview */}
      <div className="top-dashboard-summary">
        <div className="summary-chart-container">
          <DoughnutChart
            counts={healthCounts}
            totalServices={services.length}
          />
        </div>

        <div className="stats-grid">
          <div className="stat-card stat-healthy">
            <Zap size={24} />
            <div className="stat-value">{services.length}</div>
            <div className="stat-label">Total Services</div>
          </div>
          <div className="stat-card stat-remediating">
            <HardHat size={24} />
            <div className="stat-value">{remediatingCount}</div>
            <div className="stat-label">Remediating</div>
          </div>
          <div className="stat-card stat-critical">
            <XCircle size={24} />
            <div className="stat-value">{criticalCount}</div>
            <div className="stat-label">Critical</div>
          </div>
          <div className="stat-card stat-warning">
            <AlertTriangle size={24} />
            <div className="stat-value">{warningCount}</div>
            <div className="stat-label">Warnings</div>
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
