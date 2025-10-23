import React from 'react';
import { STATUS_COLORS } from '../../utils/constants';

const CHART_SIZE = 180; // Increased size
const CHART_RADIUS = 70;
const CHART_STROKE = 30; // Thicker stroke
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;

const DoughnutChart = React.memo(({ counts, totalServices }) => {
  if (totalServices === 0) {
    return (
      <div className="chart-placeholder">
        <div className="placeholder-content">
          <div className="placeholder-icon">📊</div>
          <div className="placeholder-text">No Services</div>
        </div>
      </div>
    );
  }

  // Define the order for drawing the segments
  const healthData = [
    { status: 'CRITICAL', value: counts.critical, color: STATUS_COLORS['CRITICAL'], label: 'Critical' },
    { status: 'WARNING', value: counts.warning, color: STATUS_COLORS['WARNING'], label: 'Warning' },
    { status: 'REMEDIATING', value: counts.remediating, color: STATUS_COLORS['REMEDIATING'], label: 'Remediating' },
    { status: 'HEALTHY', value: counts.healthy, color: STATUS_COLORS['HEALTHY'], label: 'Healthy' },
  ].filter(item => item.value > 0);

  let cumulativePercent = 0;
  
  // Calculate SVG stroke attributes for each segment
  const segments = healthData.map(item => {
    const percent = item.value / totalServices;
    const dashArray = percent * CHART_CIRCUMFERENCE;
    const dashOffset = cumulativePercent * CHART_CIRCUMFERENCE;
    
    cumulativePercent += percent;

    return {
      ...item,
      dashArray: dashArray,
      dashOffset: -dashOffset,
    };
  });

  return (
    <div className="doughnut-chart-widget-improved">
      <div className="chart-header-improved">
        <h3 className="chart-title-improved">Overall System Health</h3>
        <div className="chart-subtitle">Live Status</div>
      </div>
      
      <div className="chart-content-improved">
        <svg
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
          width={CHART_SIZE}
          height={CHART_SIZE}
          className="doughnut-svg-improved"
        >
          <g transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}>
            {/* Background track */}
            <circle
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={CHART_RADIUS}
              fill="transparent"
              stroke="var(--chart-track-color)"
              strokeWidth={CHART_STROKE}
              opacity="0.2"
            />

            {/* Data segments */}
            {segments.map((segment, index) => (
              <circle
                key={segment.status}
                cx={CHART_SIZE / 2}
                cy={CHART_SIZE / 2}
                r={CHART_RADIUS}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={CHART_STROKE}
                strokeDasharray={`${segment.dashArray} ${CHART_CIRCUMFERENCE - segment.dashArray}`}
                strokeDashoffset={segment.dashOffset}
                strokeLinecap="round"
                style={{ 
                  transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
              />
            ))}
          </g>
          
          {/* Center Content */}
          <g>
            <circle 
              cx={CHART_SIZE / 2} 
              cy={CHART_SIZE / 2} 
              r={CHART_RADIUS - CHART_STROKE} 
              fill="var(--bg-medium)" 
            />
            <text 
              x="50%" 
              y="45%" 
              dominantBaseline="middle" 
              textAnchor="middle" 
              className="chart-center-total-improved"
            >
              {totalServices}
            </text>
            <text 
              x="50%" 
              y="55%" 
              dominantBaseline="middle" 
              textAnchor="middle" 
              className="chart-center-label-improved"
            >
              Services
            </text>
            <text 
              x="50%" 
              y="68%" 
              dominantBaseline="middle" 
              textAnchor="middle" 
              className="chart-center-healthy-improved"
            >
              {counts.healthy} Healthy
            </text>
          </g>
        </svg>
        
        {/* Enhanced Legend */}
        <div className="chart-legend-improved">
          <div className="legend-header">
            <span className="legend-title">Status Breakdown</span>
          </div>
          <div className="legend-items-improved">
            {healthData.map(item => (
              <div key={item.status} className="legend-item-improved">
                <div className="legend-color-container">
                  <span 
                    className="legend-color-improved" 
                    style={{ backgroundColor: item.color }}
                  ></span>
                </div>
                <div className="legend-info">
                  <span className="legend-label-improved">{item.label}</span>
                  <span className="legend-value-improved">
                    {item.value} <span className="legend-percent">({((item.value / totalServices) * 100).toFixed(0)}%)</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default DoughnutChart;