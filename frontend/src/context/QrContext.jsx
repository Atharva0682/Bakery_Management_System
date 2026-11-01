import React, { createContext, useContext, useState, useEffect } from 'react';

const QrContext = createContext();

const STORAGE_KEY = 'crumb_active_qr_session';

export const QrProvider = ({ children }) => {
  const [qrSession, setQrSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setQrContext = (qrData) => {
    if (!qrData) {
      clearQrContext();
      return;
    }
    const session = {
      uniqueCode: qrData.uniqueCode,
      qrType: qrData.qrType,
      locationTag: qrData.locationTag,
      targetUrl: qrData.targetUrl,
      isActive: qrData.isActive,
      business: qrData.business,
      scannedAt: new Date().toISOString(),
    };
    setQrSession(session);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('Could not persist QR session to sessionStorage', e);
    }
  };

  const clearQrContext = () => {
    setQrSession(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear QR session from sessionStorage', e);
    }
  };

  return (
    <QrContext.Provider
      value={{
        qrSession,
        qrCode: qrSession?.uniqueCode || null,
        qrType: qrSession?.qrType || null,
        locationTag: qrSession?.locationTag || null,
        business: qrSession?.business || null,
        isActive: qrSession?.isActive || false,
        hasTableContext: Boolean(qrSession?.qrType === 'table_order' && qrSession?.locationTag),
        setQrContext,
        clearQrContext,
      }}
    >
      {children}
    </QrContext.Provider>
  );
};

export const useQr = () => {
  const context = useContext(QrContext);
  if (!context) {
    throw new Error('useQr must be used within a QrProvider');
  }
  return context;
};

export default QrContext;
