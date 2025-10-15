import React, { useState, useEffect } from 'react';
import { Zap, Bell, User, Menu, Sun, Moon, Server, ServerOff } from 'lucide-react';

const Header = ({ 
  theme, 
  toggleTheme, 
  showSidebarMobile, 
  setShowSidebarMobile, 
  services 
}) => {
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected', 'disconnected', 'checking'
  const [healthData, setHealthData] = useState(null);
  const userId = "HACKATHON-USER-A";
  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  // Check backend connection status using the correct API endpoint
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        setBackendStatus('checking');
        
        // Use the correct endpoint with /api prefix
        const response = await fetch('http://localhost:5000/api/health', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHealthData(data);
          setBackendStatus('connected');
          console.log('Backend connected:', data);
        } else {
          console.error('Backend responded with error:', response.status);
          setBackendStatus('disconnected');
          setHealthData(null);
        }
      } catch (error) {
        console.error('Backend connection failed:', error);
        setBackendStatus('disconnected');
        setHealthData(null);
      }
    };

    // Check immediately on component mount
    checkBackendStatus();

    // Set up interval to check every 30 seconds
    const intervalId = setInterval(checkBackendStatus, 30000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const getBackendStatusIcon = () => {
    switch (backendStatus) {
      case 'connected':
        return healthData?.status === 'degraded' 
          ? <Server size={18} className="backend-degraded" />
          : <Server size={18} className="backend-connected" />;
      case 'disconnected':
        return <ServerOff size={18} className="backend-disconnected" />;
      case 'checking':
        return <div className="backend-checking-spinner"></div>;
      default:
        return <ServerOff size={18} className="backend-disconnected" />;
    }
  };

  const getBackendStatusText = () => {
    switch (backendStatus) {
      case 'connected':
        if (healthData) {
          return healthData.status === 'degraded' 
            ? `Backend Degraded (${healthData.services_critical} critical)`
            : `Backend Healthy (${healthData.services_healthy}/${healthData.services_total})`;
        }
        return 'Backend Connected';
      case 'disconnected':
        return 'Backend Offline';
      case 'checking':
        return 'Checking Backend...';
      default:
        return 'Connection Unknown';
    }
  };

  const getBackendStatusTooltip = () => {
    if (backendStatus === 'connected' && healthData) {
      return `Status: ${healthData.status}\nHealthy: ${healthData.services_healthy}\nCritical: ${healthData.services_critical}\nTotal: ${healthData.services_total}\nUptime: ${Math.floor(healthData.uptime)}s`;
    }
    return getBackendStatusText();
  };

  return (
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
        </div>
      </div>

      <div className="flex-end">
        {/* Backend Status Indicator */}
        <div 
          className="backend-status-indicator"
          title={getBackendStatusTooltip()}
        >
          {getBackendStatusIcon()}
          <span 
            className={`backend-status-text ${backendStatus === 'checking' ? 'status-checking' : ''}`}
            style={{ display: window.innerWidth >= 768 ? 'inline' : 'none' }}
          >
            {getBackendStatusText()}
          </span>
        </div>

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
          {services && services.some(s => s.status === 'CRITICAL' || s.status === 'REMEDIATING') && (
            <span className="notification-ping"></span>
          )}
        </div>

        {/* User Badge */}
        <div className="user-badge">
          <User size={20} className="icon" />
          <span 
            className="text" 
            title={`Current User ID: ${userId}`} 
            style={{ display: window.innerWidth >= 768 ? 'block' : 'none' }}
          >
            {`User: ${userId}`}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;