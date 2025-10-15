import React, { useState, useMemo } from 'react';
import { Server, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { STATUS_CLASSES, METRIC_UNITS } from '../../utils/constants';

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
        <h3 className="info-title">
          <Search size={18} style={{marginRight: '0.5rem'}} />
          Monitoring Details
        </h3>
        <p>The AIRS agent continuously tracks the listed services. Critical (CRITICAL) and Warning (WARNING) states trigger automated remediation, visible as REMEDIATING.</p>
      </div>
    </div>
  );
};

export default ServiceCatalogView;