import React from 'react';
import { STATUS_COLORS } from '../../utils/constants';

const CHART_SIZE = 150;
const CHART_RADIUS = 60;
const CHART_STROKE = 25;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;

const DoughnutChart = React.memo(({ counts, totalServices }) => {
  if (totalServices === 0) {
    return <div className="chart-placeholder">No Services</div>;
  }

  // Define the order for drawing the segments (Critical first, then Warning, etc.)
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
    <div className="doughnut-chart-widget">
      <h3 className="chart-title">Overall System Health</h3>
      <div className="chart-inner-content">
        <svg
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
          width={CHART_SIZE}
          height={CHART_SIZE}
          className="doughnut-svg"
        >
          <g transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}>
            {/* Background track */}
            <circle
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={CHART_RADIUS}
              fill="transparent"
              stroke="var(--bg-light)"
              strokeWidth={CHART_STROKE}
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
                style={{ transition: 'stroke-dasharray 0.5s ease-out, stroke-dashoffset 0.5s ease-out' }}
              />
            ))}
          </g>
          {/* Center Text (Total Services) */}
          <text 
            x="50%" 
            y="50%" 
            dominantBaseline="middle" 
            textAnchor="middle" 
            className="chart-center-text-total"
          >
            {totalServices}
          </text>
          <text 
            x="50%" 
            y="65%" 
            dominantBaseline="middle" 
            textAnchor="middle" 
            className="chart-center-text-label"
          >
            Services
          </text>
        </svg>
        
        {/* Legend */}
        <div className="chart-legend">
          {healthData.map(item => (
            <div key={item.status} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: item.color }}></span>
              <span className="legend-label">{item.label}</span>
              <span className="legend-value" style={{ color: item.color }}>
                {item.value} ({((item.value / totalServices) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default DoughnutChart;