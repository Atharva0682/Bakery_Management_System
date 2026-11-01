import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PwaContext = createContext();

export const PwaProvider = ({ children }) => {
  const location = useLocation();
  const currentPath = location?.pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isIpad, setIsIpad] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Derive role-specific PWA context
  const currentRole = currentPath.startsWith('/staff')
    ? 'worker'
    : currentPath.startsWith('/owner')
    ? 'owner'
    : 'customer';

  // Dynamic manifest & iOS meta tag switcher
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const manifestLink = document.getElementById('app-manifest') || document.querySelector('link[rel="manifest"]');
    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (currentRole === 'worker') {
      if (manifestLink) manifestLink.href = '/manifest-baker.json';
      if (appleTitleMeta) appleTitleMeta.content = 'Baker Station';
      if (themeColorMeta) themeColorMeta.content = '#FAF6F0';
    } else if (currentRole === 'owner') {
      if (manifestLink) manifestLink.href = '/manifest-owner.json';
      if (appleTitleMeta) appleTitleMeta.content = 'Bakery Owner';
      if (themeColorMeta) themeColorMeta.content = '#FAF6F0';
    } else {
      if (manifestLink) manifestLink.href = '/manifest.json';
      if (appleTitleMeta) appleTitleMeta.content = 'Crumb & Co.';
      if (themeColorMeta) themeColorMeta.content = '#FAF6F0';
    }
  }, [currentRole]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect device environment
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIphoneOrIpod = /iphone|ipod/.test(userAgent);
    const isIpadDevice = /ipad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(userAgent);

    setIsIos(isIphoneOrIpod || isIpadDevice);
    setIsIpad(isIpadDevice);
    setIsAndroid(isAndroidDevice);

    // Check if already running in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsInstalled(isStandalone);

    // Capture standard PWA install prompt (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('[Crumb&Co. PWA] beforeinstallprompt event captured and ready.');
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsModalOpen(false);
      console.log('[Crumb&Co. PWA] App successfully installed to device!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[Crumb&Co. PWA] User response to native install prompt:', outcome);
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('[Crumb&Co. PWA] Native prompt error, falling back to guided modal:', err);
        setIsModalOpen(true);
      }
    } else {
      // If iOS, Safari, or native prompt already consumed, show the guided install modal
      setIsModalOpen(true);
    }
  };

  const openInstallModal = () => setIsModalOpen(true);
  const closeInstallModal = () => setIsModalOpen(false);

  return (
    <PwaContext.Provider
      value={{
        isInstalled,
        canPromptNatively: !!deferredPrompt,
        isIos,
        isIpad,
        isAndroid,
        currentRole,
        isModalOpen,
        promptInstall,
        openInstallModal,
        closeInstallModal,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
};
