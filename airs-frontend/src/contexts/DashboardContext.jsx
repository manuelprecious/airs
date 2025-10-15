import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { createLog } from '../utils/logging';
import { 
  LOCAL_STORAGE_KEY,
  MAX_LOGS,
  MAX_HISTORY
} from '../utils/constants';

const DashboardContext = createContext();

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export const DashboardProvider = ({ children }) => {
  const [dashboardData, setDashboardData] = useLocalStorage(LOCAL_STORAGE_KEY, {
    services: [],
    logs: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Backend configuration
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  // Check if backend is available
  const checkBackendAvailability = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
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

  // Load initial data from backend
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const isBackendAvailable = await checkBackendAvailability();
      
      if (!isBackendAvailable) {
        setError('Backend server is unavailable. Please ensure the backend server is running on port 5000.');
        setDashboardData(prevData => ({
          services: [],
          logs: prevData?.logs || []
        }));
        return;
      }

      // Fetch services from backend
      const response = await fetch(`${backendUrl}/api/services?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`Backend responded with status: ${response.status}`);
      }

      const backendServices = await response.json();
      
      // Transform backend services to frontend format
      const frontendServices = backendServices.map(backendService => {
        const statusMap = {
          'healthy': 'HEALTHY',
          'warning': 'WARNING', 
          'critical': 'CRITICAL'
        };

        const frontendStatus = backendService.remediationInProgress 
          ? 'REMEDIATING' 
          : statusMap[backendService.status] || 'HEALTHY';

        // Create realistic base metrics based on status
        let baseMetrics = {
          CPU_Load: 50,
          Memory_Use: 50,
          Latency_ms: 100,
          Error_Rate: 1,
          Disk_IO_Wait: 5
        };

        if (backendService.status === 'critical') {
          baseMetrics = {
            CPU_Load: 85 + Math.random() * 15,
            Memory_Use: 80 + Math.random() * 15,
            Latency_ms: 800 + Math.random() * 400,
            Error_Rate: 15 + Math.random() * 10,
            Disk_IO_Wait: 20 + Math.random() * 10
          };
        } else if (backendService.status === 'warning') {
          baseMetrics = {
            CPU_Load: 65 + Math.random() * 20,
            Memory_Use: 70 + Math.random() * 15,
            Latency_ms: 300 + Math.random() * 200,
            Error_Rate: 5 + Math.random() * 5,
            Disk_IO_Wait: 10 + Math.random() * 8
          };
        } else {
          baseMetrics = {
            CPU_Load: 20 + Math.random() * 40,
            Memory_Use: 30 + Math.random() * 40,
            Latency_ms: 50 + Math.random() * 150,
            Error_Rate: 0.5 + Math.random() * 2,
            Disk_IO_Wait: 2 + Math.random() * 8
          };
        }

        // Determine the most critical metric
        const metricEntries = Object.entries(baseMetrics);
        const [primaryMetric, primaryValue] = metricEntries.reduce((mostCritical, [metric, value]) => {
          if (!mostCritical) return [metric, value];
          return value > mostCritical[1] ? [metric, value] : mostCritical;
        });

        const alertId = backendService.status === 'critical' 
          ? `ALERT-${backendService.id}` 
          : backendService.status === 'warning'
          ? `WARN-${backendService.id}`
          : null;

        // Create initial history
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
          allMetrics: baseMetrics
        };
      });

      setDashboardData(prevData => ({
        services: frontendServices,
        logs: prevData?.logs || []
      }));

      setError(null);
    } catch (error) {
      setError(error.message);
      setBackendAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [checkBackendAvailability, setDashboardData, backendUrl]);

  // Update ONLY the metric values without reloading everything
  const updateMetricValues = useCallback(() => {
    setDashboardData(prevData => {
      if (!prevData || !prevData.services || prevData.services.length === 0) return prevData;

      const updatedServices = prevData.services.map(service => {
        // Create updated metrics with realistic fluctuations
        const updatedAllMetrics = { ...service.allMetrics };
        
        // Update each metric with realistic fluctuations based on service status
        const serviceStatus = service.backendData?.status || 'healthy';
        
        // CPU fluctuations
        updatedAllMetrics.CPU_Load = getUpdatedMetricValue(
          updatedAllMetrics.CPU_Load, 
          'CPU_Load', 
          serviceStatus
        );
        
        // Memory fluctuations
        updatedAllMetrics.Memory_Use = getUpdatedMetricValue(
          updatedAllMetrics.Memory_Use,
          'Memory_Use',
          serviceStatus
        );
        
        // Latency fluctuations
        updatedAllMetrics.Latency_ms = getUpdatedMetricValue(
          updatedAllMetrics.Latency_ms,
          'Latency_ms',
          serviceStatus
        );
        
        // Error rate fluctuations
        updatedAllMetrics.Error_Rate = getUpdatedMetricValue(
          updatedAllMetrics.Error_Rate,
          'Error_Rate',
          serviceStatus
        );

        // Determine the new most critical metric
        const metricEntries = Object.entries(updatedAllMetrics);
        const [newPrimaryMetric, newPrimaryValue] = metricEntries.reduce((mostCritical, [metric, value]) => {
          if (!mostCritical) return [metric, value];
          return value > mostCritical[1] ? [metric, value] : mostCritical;
        });

        // Update history for the primary metric
        const newHistory = [...service.history.slice(1), newPrimaryValue];

        return {
          ...service,
          metric: newPrimaryMetric,
          value: newPrimaryValue,
          history: newHistory,
          allMetrics: updatedAllMetrics
        };
      });

      return {
        ...prevData,
        services: updatedServices
      };
    });
  }, []);

  // Helper function to update individual metric values
  const getUpdatedMetricValue = (currentValue, metricType, serviceStatus) => {
    let fluctuation = 0;
    let newValue = currentValue || 50;

    // Different fluctuation patterns based on metric type and service status
    switch(metricType) {
      case 'CPU_Load':
        if (serviceStatus === 'critical') {
          fluctuation = (Math.random() - 0.3) * 8; // Mostly increasing
        } else if (serviceStatus === 'warning') {
          fluctuation = (Math.random() - 0.4) * 6; // Slight upward bias
        } else {
          fluctuation = (Math.random() - 0.5) * 4; // Balanced
        }
        break;
      
      case 'Memory_Use':
        if (serviceStatus === 'critical') {
          fluctuation = (Math.random() - 0.2) * 6; // Mostly increasing
        } else if (serviceStatus === 'warning') {
          fluctuation = (Math.random() - 0.3) * 5; // Slight upward bias
        } else {
          fluctuation = (Math.random() - 0.5) * 3; // Balanced
        }
        break;
      
      case 'Latency_ms':
        if (serviceStatus === 'critical') {
          fluctuation = (Math.random() + 0.3) * 50; // Mostly increasing with spikes
        } else if (serviceStatus === 'warning') {
          fluctuation = (Math.random() - 0.1) * 30; // Slight upward bias
        } else {
          fluctuation = (Math.random() - 0.5) * 20; // Balanced
        }
        break;
      
      case 'Error_Rate':
        if (serviceStatus === 'critical') {
          fluctuation = (Math.random() + 0.4) * 3; // Mostly increasing
        } else if (serviceStatus === 'warning') {
          fluctuation = (Math.random() - 0.2) * 2; // Slight upward bias
        } else {
          fluctuation = (Math.random() - 0.6) * 1; // Mostly decreasing
        }
        break;
      
      default:
        fluctuation = (Math.random() - 0.5) * 5;
    }

    newValue += fluctuation;

    // Keep values in reasonable bounds
    if (metricType === 'Latency_ms') {
      newValue = Math.max(10, Math.min(2000, newValue));
      return Math.round(newValue);
    } else if (metricType === 'Error_Rate') {
      newValue = Math.max(0.1, Math.min(25, newValue));
    } else {
      newValue = Math.max(1, Math.min(100, newValue));
    }

    return parseFloat(newValue.toFixed(1));
  };

  // Start remediation
  const startRemediation = useCallback(async (serviceId, currentService, isManual = false) => {
    if (!backendAvailable) {
      setError('Cannot start remediation - backend server is unavailable');
      return;
    }

    try {
      // Update UI immediately to remediating
      setDashboardData(prevData => {
        if (!prevData) return null;

        const updatedServices = prevData.services.map(service => 
          service.id === serviceId 
            ? { ...service, status: 'REMEDIATING' }
            : service
        );

        const logType = isManual ? 'MANUAL_OVERRIDE' : 'AGENT_TRIGGERED';
        const remediationLog = createLog(logType, currentService);
        const updatedLogs = [remediationLog, ...prevData.logs].slice(0, MAX_LOGS);

        return { services: updatedServices, logs: updatedLogs };
      });

      // After delay, set to healthy with improved metrics
      setTimeout(() => {
        setDashboardData(prevData => {
          if (!prevData) return null;

          const healedServices = prevData.services.map(service => {
            if (service.id === serviceId) {
              // Set to healthy values
              const healthyMetrics = {
                CPU_Load: 25 + Math.random() * 15,
                Memory_Use: 35 + Math.random() * 20,
                Latency_ms: 50 + Math.random() * 50,
                Error_Rate: 0.5 + Math.random() * 1,
                Disk_IO_Wait: 3 + Math.random() * 4
              };

              // Determine new primary metric
              const metricEntries = Object.entries(healthyMetrics);
              const [primaryMetric, primaryValue] = metricEntries.reduce((mostCritical, [metric, value]) => {
                if (!mostCritical) return [metric, value];
                return value > mostCritical[1] ? [metric, value] : mostCritical;
              });

              const newHistory = Array(MAX_HISTORY).fill(primaryValue);

              return {
                ...service,
                status: 'HEALTHY',
                metric: primaryMetric,
                value: primaryValue,
                history: newHistory,
                allMetrics: healthyMetrics,
                alert_id: null
              };
            }
            return service;
          });

          const successLog = createLog('AGENT_SUCCESS', currentService);
          const updatedLogs = [successLog, ...prevData.logs].slice(0, MAX_LOGS);

          return { services: healedServices, logs: updatedLogs };
        });
      }, 4000);

    } catch (error) {
      setError(`Remediation failed: ${error.message}`);
      
      // Revert status on error
      setDashboardData(prevData => {
        if (!prevData) return null;
        const revertedServices = prevData.services.map(service => 
          service.id === serviceId 
            ? { ...service, status: currentService.status }
            : service
        );
        return { ...prevData, services: revertedServices };
      });
    }
  }, [backendAvailable]);

  // Initial data load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Set up interval for dynamic metric value updates (every 2 seconds)
  useEffect(() => {
    const intervalId = setInterval(updateMetricValues, 2000);
    return () => clearInterval(intervalId);
  }, [updateMetricValues]);

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
    refreshData: loadDashboardData
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};