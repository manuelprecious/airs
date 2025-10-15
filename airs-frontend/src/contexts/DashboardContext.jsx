import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { createLog } from '../utils/logging';
import { updateMetricAndStatus } from '../utils/simulation';
import { 
  DEFAULT_SERVICES, 
  SIMULATION_INTERVAL_MS, 
  REMEDIATION_DELAY_MS, 
  MAX_LOGS,
  LOCAL_STORAGE_KEY 
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
    services: DEFAULT_SERVICES,
    logs: []
  });

  const services = dashboardData?.services;
  const logs = dashboardData?.logs;

  const startRemediation = useCallback((id, currentService, isManual = false) => {
    if (!services) return;

    const logType = isManual ? 'MANUAL_OVERRIDE' : 'AGENT_TRIGGERED';

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

    setTimeout(() => {
      setDashboardData(prevData => {
        if (!prevData) return null;

        const postRemediationServices = prevData.services.map(s => {
          if (s.id === id) {
            let healthyValue;
            if (s.metric === 'Latency_ms') { healthyValue = 100 + Math.random() * 20; }
            else if (s.metric === 'Error_Rate') { healthyValue = 1 + Math.random(); }
            else if (s.metric === 'Disk_IO_Wait') { healthyValue = 3 + Math.random() * 2; }
            else { healthyValue = 30 + Math.random() * 5; }

            const newHistory = [...s.history.slice(1), parseFloat(healthyValue.toFixed(1))];

            return {
              ...s,
              value: parseFloat(healthyValue.toFixed(1)),
              status: 'HEALTHY',
              history: newHistory,
              alert_id: null,
            };
          }
          return s;
        });

        const successService = postRemediationServices.find(s => s.id === id) || currentService;
        const successLog = createLog('AGENT_SUCCESS', successService);
        
        const logIndexToReplace = prevData.logs.findIndex(log => 
          log.serviceName === successService.name && log.type === logType
        );
        let finalLogs = [...prevData.logs];
        if (logIndexToReplace !== -1) {
          finalLogs.splice(logIndexToReplace, 1);
        }
        finalLogs = [successLog, ...finalLogs].slice(0, MAX_LOGS);

        return { services: postRemediationServices, logs: finalLogs };
      });
    }, REMEDIATION_DELAY_MS);
  }, [services, setDashboardData]);

  // Metric simulation effect
  useEffect(() => {
    if (!services) return;

    services.forEach(service => {
      if (service.status === 'CRITICAL' && service.alert_id && service.alert_id.startsWith('ALERT') && service.status !== 'REMEDIATING') {
        startRemediation(service.id, service, false);
      }
    });

    const interval = setInterval(() => {
      setDashboardData(prevData => {
        if (!prevData) return null;

        let newLogs = [...prevData.logs];
        const newServices = prevData.services.map(service => {
          if (service.status === 'REMEDIATING') return service;

          const updatedService = updateMetricAndStatus(service);

          if (updatedService.status === 'CRITICAL' && service.status !== 'CRITICAL') {
            const newAlertId = `ALERT-${Math.floor(Math.random() * 900) + 100}`;
            const serviceWithAlert = { ...updatedService, alert_id: newAlertId };
            
            startRemediation(serviceWithAlert.id, serviceWithAlert, false);
            return { ...serviceWithAlert, status: 'REMEDIATING' };
          }
          
          if (updatedService.status === 'WARNING' && service.status !== 'WARNING' && service.status !== 'CRITICAL') {
            const newWarnId = `WARN-${Math.floor(Math.random() * 900) + 100}`;
            newLogs = [createLog('WARNING', updatedService), ...newLogs].slice(0, MAX_LOGS);
            return { ...updatedService, alert_id: newWarnId };
          }

          if (updatedService.status === 'HEALTHY' && service.alert_id && service.alert_id.startsWith('WARN')) {
            return { ...updatedService, alert_id: null };
          }
          
          return updatedService;
        });

        return { services: newServices, logs: newLogs };
      });
    }, SIMULATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [services, startRemediation, setDashboardData]);

  const value = {
    services,
    logs,
    startRemediation,
    setDashboardData
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};