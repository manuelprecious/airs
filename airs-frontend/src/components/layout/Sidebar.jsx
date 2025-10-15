import React from 'react';
import { Activity, LayoutDashboard, Server, Users, Settings, ChevronLeft } from 'lucide-react';

const Sidebar = ({ 
  currentView, 
  setCurrentView, 
  isSidebarExpanded, 
  setIsSidebarExpanded, 
  showSidebarMobile, 
  setShowSidebarMobile 
}) => {
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Services', icon: Server },
    { name: 'Team', icon: Users },
    { name: 'Settings', icon: Settings },
  ];

  return (
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
        {navItems.map(({ name, icon: Icon }) => (
          <button
            key={name}
            onClick={() => { 
              setCurrentView(name); 
              setShowSidebarMobile(false); 
            }}
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
};

export default Sidebar;