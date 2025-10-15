import React, { useState, useEffect } from 'react';
import { DashboardProvider, useDashboard } from './contexts/DashboardContext';
import { useLocalStorage } from './hooks/useLocalStorage';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainDashboardView from './components/dashboard/MainDashboardView';
import ServiceCatalogView from './components/services/ServiceCatalogView';
import PlaceholderView from './components/common/PlaceholderView';
import { Users, Settings } from 'lucide-react';
import { THEME_STORAGE_KEY } from './utils/constants';
import './App.css';

const AppContent = () => {
  const [theme, setTheme] = useLocalStorage(THEME_STORAGE_KEY, 'dark');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => window.innerWidth >= 1024);
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);
  const [currentView, setCurrentView] = useState('Dashboard');

  const { services, logs, startRemediation } = useDashboard();

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const renderView = () => {
    switch (currentView) {
      case 'Dashboard':
        return <MainDashboardView services={services} logs={logs} startRemediation={startRemediation} />;
      case 'Services':
        return <ServiceCatalogView services={services} />;
      case 'Team':
        return <PlaceholderView title="Team Directory" icon={Users} />;
      case 'Settings':
        return <PlaceholderView title="Agent Configuration" icon={Settings} />;
      default:
        return <MainDashboardView services={services} logs={logs} startRemediation={startRemediation} />;
    }
  };

  const desktopMarginLeft = isSidebarExpanded ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)';

  return (
    <div className={`app-container ${theme}-mode`}>
      <Header 
        theme={theme}
        toggleTheme={toggleTheme}
        showSidebarMobile={showSidebarMobile}
        setShowSidebarMobile={setShowSidebarMobile}
        services={services}
      />
      
      <div className="app-layout">
        {showSidebarMobile && window.innerWidth < 1024 && (
          <div
            onClick={() => setShowSidebarMobile(false)}
            className="mobile-overlay"
          />
        )}

        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          isSidebarExpanded={isSidebarExpanded}
          setIsSidebarExpanded={setIsSidebarExpanded}
          showSidebarMobile={showSidebarMobile}
          setShowSidebarMobile={setShowSidebarMobile}
        />

        <div 
          className={`main-content-wrapper ${isSidebarExpanded ? '' : 'collapsed'}`}
          style={{
            marginLeft: window.innerWidth >= 1024 ? desktopMarginLeft : '0',
          }}
        >
          <main className="app-main-content">
            {renderView()}
          </main>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <DashboardProvider>
      <AppContent />
    </DashboardProvider>
  );
};

export default App;