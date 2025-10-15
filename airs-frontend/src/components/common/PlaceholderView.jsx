import React from 'react';

const PlaceholderView = ({ title, icon: Icon }) => (
  <div className="placeholder-container">
    <div className="placeholder-content">
      <Icon size={48} className="placeholder-icon" />
      <h2 className="placeholder-title">{title}</h2>
      <p className="placeholder-text">This view is coming soon.</p>
    </div>
  </div>
);

export default PlaceholderView;