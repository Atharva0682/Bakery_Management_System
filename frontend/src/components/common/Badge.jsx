import React from 'react';

const Badge = ({ type = 'fresh', children }) => {
  const getBadgeStyle = () => {
    switch (type) {
      case 'fresh':
        return {
          backgroundColor: '#E8F5E9',
          color: '#2E7D32',
          border: '1px solid #C8E6C9',
        };
      case 'eggless':
        return {
          backgroundColor: '#FFF3E0',
          color: '#E65100',
          border: '1px solid #FFE0B2',
        };
      case 'bestseller':
        return {
          backgroundColor: '#FEF3C7',
          color: '#92400E',
          border: '1px solid #FDE68A',
        };
      case 'status-progress':
        return {
          backgroundColor: '#E0F2FE',
          color: '#0369A1',
          border: '1px solid #BAE6FD',
        };
      case 'status-delivered':
        return {
          backgroundColor: '#DCFCE7',
          color: '#15803D',
          border: '1px solid #BBF7D0',
        };
      default:
        return {
          backgroundColor: 'var(--bg-surface-soft)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-light)',
        };
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.2px',
        ...getBadgeStyle(),
      }}
    >
      {children}
    </span>
  );
};

export default Badge;
