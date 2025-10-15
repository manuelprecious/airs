import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { createLog } from "../utils/logging";
import { LOCAL_STORAGE_KEY, MAX_LOGS, MAX_HISTORY } from "../utils/constants";

const DashboardContext = createContext();

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};

export const DashboardProvider = ({ children }) => {
  const [dashboardData, setDashboardData] = useLocalStorage(LOCAL_STORAGE_KEY, {
    services: [],
    logs: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Backend configuration
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Check if backend is available
  const checkBackendAvailability = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-cache",
      });

      if (response.ok) {
        setBackendAvailable(true);
        return true;
      } else {
        setBackendAvailable(false);
        return false;
      }
    } catch (error) {
      setBackendAvailable(false);
      return false;
    }
  }, [backendUrl]);

  // Get detailed metrics for a specific service
  const fetchServiceMetrics = useCallback(
    async (serviceId) => {
      try {
        const response = await fetch(
          `${backendUrl}/api/services/${serviceId}/metrics?_t=${Date.now()}`
        );
        if (!response.ok) throw new Error("Failed to fetch metrics");
        return await response.json();
      } catch (error) {
        console.error(
          `Failed to fetch metrics for service ${serviceId}:`,
          error
        );
        return null;
      }
    },
    [backendUrl]
  );

  // Poll backend for real state and metric changes
  const pollBackendState = useCallback(async () => {
    if (!backendAvailable) return;

    try {
      // Get basic services list
      const servicesResponse = await fetch(
        `${backendUrl}/api/services?_t=${Date.now()}`
      );
      if (!servicesResponse.ok) return;
      const basicServices = await servicesResponse.json();

      // Get detailed metrics for each service
      const servicesWithDetails = await Promise.all(
        basicServices.map(async (basicService) => {
          const details = await fetchServiceMetrics(basicService.id);
          return {
            ...basicService,
            metrics: details?.metrics || basicService.metrics,
          };
        })
      );

      setDashboardData((prevData) => {
        if (!prevData || !prevData.services) return prevData;

        const updatedServices = servicesWithDetails.map((backendService) => {
          // Map backend status to frontend status
          const statusMap = {
            healthy: "HEALTHY",
            warning: "WARNING",
            critical: "CRITICAL",
          };

          const newStatus = backendService.remediationInProgress
            ? "REMEDIATING"
            : statusMap[backendService.status] || "HEALTHY";

          // Use REAL backend metrics with ServiceCard-compatible property names
          const realMetrics = {
            cpu: backendService.metrics?.cpu || 0,
            memory: backendService.metrics?.memory || 0,
            latency: backendService.metrics?.latency || 0,
            error_rate: backendService.metrics?.error_rate || 0,
            disk_io_wait: backendService.metrics?.throughput
              ? Math.max(0, 100 - backendService.metrics.throughput / 12)
              : 0,
          };

          // Map to frontend metric display names
          const metricMap = {
            cpu: "CPU_Load",
            memory: "Memory_Use",
            latency: "Latency_ms",
            error_rate: "Error_Rate",
            disk_io_wait: "Disk_IO_Wait",
          };

          // Determine the most critical metric
          const metricEntries = Object.entries(realMetrics);
          const [primaryMetricKey, primaryValue] = metricEntries.reduce(
            (mostCritical, [metric, value]) => {
              if (!mostCritical) return [metric, value];
              return value > mostCritical[1] ? [metric, value] : mostCritical;
            },
            ["cpu", 0]
          );

          const primaryMetric = metricMap[primaryMetricKey] || "CPU_Load";

          // Find existing service to preserve history
          const existingService = prevData.services.find(
            (s) => s.id === backendService.id
          );
          const existingHistory =
            existingService?.history || Array(MAX_HISTORY).fill(primaryValue);

          // Update history with new value
          const newHistory = [...existingHistory.slice(1), primaryValue];

          const alertId =
            backendService.status === "critical"
              ? `ALERT-${backendService.id}`
              : backendService.status === "warning"
              ? `WARN-${backendService.id}`
              : null;

          return {
            id: backendService.id,
            name: backendService.name,
            status: newStatus,
            metric: primaryMetric,
            value: primaryValue,
            history: newHistory,
            alert_id: alertId,
            backendData: backendService,
            allMetrics: realMetrics,
            instanceCount: backendService.instanceCount,
            awaitingRemediation: backendService.awaitingRemediation,
          };
        });

        return {
          ...prevData,
          services: updatedServices,
        };
      });
    } catch (error) {
      console.log("Backend polling failed:", error);
    }
  }, [backendAvailable, backendUrl, fetchServiceMetrics]);

  // Load initial data from backend
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isBackendAvailable = await checkBackendAvailability();

      if (!isBackendAvailable) {
        setError(
          "Backend server is unavailable. Please ensure the backend server is running on port 5000."
        );
        setDashboardData((prevData) => ({
          services: [],
          logs: prevData?.logs || [],
        }));
        return;
      }

      // Get basic services list
      const servicesResponse = await fetch(
        `${backendUrl}/api/services?_t=${Date.now()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-cache",
        }
      );

      if (!servicesResponse.ok) {
        throw new Error(
          `Backend responded with status: ${servicesResponse.status}`
        );
      }

      const basicServices = await servicesResponse.json();

      // Get detailed metrics for each service
      const servicesWithDetails = await Promise.all(
        basicServices.map(async (basicService) => {
          const details = await fetchServiceMetrics(basicService.id);
          return {
            ...basicService,
            metrics: details?.metrics || basicService.metrics,
          };
        })
      );

      // Transform backend services to frontend format USING REAL METRICS
      const frontendServices = servicesWithDetails.map((backendService) => {
        const statusMap = {
          healthy: "HEALTHY",
          warning: "WARNING",
          critical: "CRITICAL",
        };

        const frontendStatus = backendService.remediationInProgress
          ? "REMEDIATING"
          : statusMap[backendService.status] || "HEALTHY";

        // USE REAL BACKEND METRICS with ServiceCard-compatible property names
        const realMetrics = {
          cpu: backendService.metrics?.cpu || 0,
          memory: backendService.metrics?.memory || 0,
          latency: backendService.metrics?.latency || 0,
          error_rate: backendService.metrics?.error_rate || 0,
          disk_io_wait: backendService.metrics?.throughput
            ? Math.max(0, 100 - backendService.metrics.throughput / 12)
            : 0,
        };

        // Map to frontend metric display names
        const metricMap = {
          cpu: "CPU_Load",
          memory: "Memory_Use",
          latency: "Latency_ms",
          error_rate: "Error_Rate",
          disk_io_wait: "Disk_IO_Wait",
        };

        // Determine the most critical metric
        const metricEntries = Object.entries(realMetrics);
        const [primaryMetricKey, primaryValue] = metricEntries.reduce(
          (mostCritical, [metric, value]) => {
            if (!mostCritical) return [metric, value];
            return value > mostCritical[1] ? [metric, value] : mostCritical;
          },
          ["cpu", 0]
        );

        const primaryMetric = metricMap[primaryMetricKey] || "CPU_Load";

        const alertId =
          backendService.status === "critical"
            ? `ALERT-${backendService.id}`
            : backendService.status === "warning"
            ? `WARN-${backendService.id}`
            : null;

        // Create initial history with REAL values
        const initialHistory = Array(MAX_HISTORY).fill(primaryValue);

        return {
          id: backendService.id,
          name: backendService.name,
          status: frontendStatus,
          metric: primaryMetric,
          value: primaryValue,
          history: initialHistory,
          alert_id: alertId,
          backendData: backendService,
          allMetrics: realMetrics,
          instanceCount: backendService.instanceCount,
          awaitingRemediation: backendService.awaitingRemediation,
        };
      });

      setDashboardData((prevData) => ({
        services: frontendServices,
        logs: prevData?.logs || [],
      }));

      setError(null);
    } catch (error) {
      setError(error.message);
      setBackendAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    checkBackendAvailability,
    setDashboardData,
    backendUrl,
    fetchServiceMetrics,
  ]);

  // Start remediation
  const startRemediation = useCallback(
    async (serviceId, currentService, isManual = false) => {
      if (!backendAvailable) {
        setError("Cannot start remediation - backend server is unavailable");
        return;
      }

      try {
        // Call the actual backend remediation API
        const response = await fetch(
          `${backendUrl}/api/services/${serviceId}/remediate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "restart_service", // REQUIRED: Choose appropriate action
              reason: isManual
                ? "Manual user intervention"
                : "Automated by AIRS agent",
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to start remediation");
        }

        // Backend will handle the remediation process
        const result = await response.json();

        // Update UI to show remediation in progress
        setDashboardData((prevData) => {
          if (!prevData) return prevData;

          const updatedServices = prevData.services.map((service) =>
            service.id === serviceId
              ? { ...service, status: "REMEDIATING" }
              : service
          );

          const logType = isManual ? "MANUAL_OVERRIDE" : "AGENT_TRIGGERED";
          const remediationLog = createLog(logType, currentService);
          const updatedLogs = [remediationLog, ...prevData.logs].slice(
            0,
            MAX_LOGS
          );

          return { services: updatedServices, logs: updatedLogs };
        });
      } catch (error) {
        setError(`Remediation failed: ${error.message}`);

        // Revert status on error
        setDashboardData((prevData) => {
          if (!prevData) return prevData;
          const revertedServices = prevData.services.map((service) =>
            service.id === serviceId
              ? { ...service, status: currentService.status }
              : service
          );
          return { ...prevData, services: revertedServices };
        });
      }
    },
    [backendAvailable, backendUrl, setDashboardData]
  );

  // Initial data load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Set up interval for backend state polling (every 2 seconds)
  useEffect(() => {
    const intervalId = setInterval(pollBackendState, 2000);
    return () => clearInterval(intervalId);
  }, [pollBackendState]);

  // Check backend availability periodically (every 30 seconds)
  useEffect(() => {
    const intervalId = setInterval(checkBackendAvailability, 30000);
    return () => clearInterval(intervalId);
  }, [checkBackendAvailability]);

  const value = {
    services: dashboardData?.services || [],
    logs: dashboardData?.logs || [],
    startRemediation,
    isLoading,
    error,
    backendAvailable,
    refreshData: loadDashboardData,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};
