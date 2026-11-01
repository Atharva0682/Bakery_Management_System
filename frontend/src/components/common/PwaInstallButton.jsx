import React from 'react';
import { Download, Smartphone, Tablet } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

const PwaInstallButton = ({ variant = 'header', style = {} }) => {
  const { promptInstall, isInstalled, isIos, isIpad, isAndroid, currentRole } = usePwa();

  if (isInstalled) return null;

  // Derive dynamic label based on role & device
  const getLabel = () => {
    if (currentRole === 'worker') {
      return isIpad ? 'Install Baker iPad App' : 'Install Baker Station';
    }
    if (currentRole === 'owner') {
      return isIpad ? 'Install Owner iPad App' : 'Install Owner Console';
    }
    if (isIpad) return 'Install iPad App';
    if (isIos) return 'Install iOS App';
    if (isAndroid) return 'Install Android App';
    return 'Install Bakery App';
  };

  const buttonTitle = isIpad
    ? 'Install iPad Tablet PWA'
    : isIos
    ? 'Install iPhone iOS PWA'
    : isAndroid
    ? 'Install Android PWA'
    : 'Download & Install Application';

  if (variant === 'pill') {
    return (
      <button
        onClick={promptInstall}
        className="btn btn-pill"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#AD642E',
          color: '#FFFFFF',
          padding: '8px 18px',
          fontSize: '13px',
          fontWeight: 600,
          borderRadius: '9999px',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 3px 8px rgba(173, 100, 46, 0.25)',
          transition: 'transform 0.15s, background-color 0.15s',
          ...style,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#935122')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#AD642E')}
        title={buttonTitle}
      >
        <Download size={15} />
        <span>{getLabel()}</span>
      </button>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        style={{
          background: 'linear-gradient(90deg, #5A3825 0%, #8B5A2B 45%, #D96C8A 100%)',
          color: '#FFFFFF',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 2px 8px rgba(48, 37, 31, 0.12)',
          position: 'relative',
          zIndex: 40,
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🥐</span>
          <span>
            <strong>Crumb & Co. {currentRole === 'worker' ? 'Baker Station' : currentRole === 'owner' ? 'Owner Portal' : 'Web App'}</strong> — Add to Home Screen for fast, full-screen {currentRole === 'worker' || currentRole === 'owner' ? 'operations!' : 'ordering!'}
          </span>
        </div>
        <button
          onClick={promptInstall}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#5A3825',
            border: 'none',
            borderRadius: '9999px',
            padding: '5px 14px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <Download size={13} />
          <span>Install Now</span>
        </button>
      </div>
    );
  }

  // Default header action
  return (
    <button
      onClick={promptInstall}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'rgba(173, 100, 46, 0.08)',
        color: '#AD642E',
        border: '1px solid rgba(173, 100, 46, 0.25)',
        borderRadius: '9999px',
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#AD642E';
        e.currentTarget.style.color = '#FFFFFF';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(173, 100, 46, 0.08)';
        e.currentTarget.style.color = '#AD642E';
      }}
      title={buttonTitle}
    >
      <Download size={14} />
      <span>{getLabel()}</span>
    </button>
  );
};

export default PwaInstallButton;
