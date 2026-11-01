import React from 'react';
import { X, Download, Share, PlusSquare, Smartphone, Tablet, CheckCircle, Sparkles } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';
import BrandLogo from './BrandLogo';

const PwaInstallModal = () => {
  const {
    isModalOpen,
    closeInstallModal,
    isIos,
    isIpad,
    isAndroid,
    canPromptNatively,
    promptInstall,
    isInstalled,
    currentRole
  } = usePwa();

  if (!isModalOpen) return null;

  // Derive contextual app name & description
  const appTitle = currentRole === 'worker'
    ? 'Install Baker Station'
    : currentRole === 'owner'
    ? 'Install Owner Console'
    : 'Install Crumb & Co.';

  const appDescription = currentRole === 'worker'
    ? 'Kitchen Display System, secret recipes, batch timers & floor logs'
    : currentRole === 'owner'
    ? 'Executive analytics, payment verification & inventory controls'
    : 'Artisanal sourdough, pastries & live order tracking';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(48, 37, 31, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 99999,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={closeInstallModal}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(48, 37, 31, 0.25)',
          border: '1px solid #E8E0D7',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #5A3825 0%, #8B5A2B 60%, #AD642E 100%)',
            padding: '28px 24px 20px',
            color: '#FFFFFF',
            position: 'relative',
            textAlign: 'center',
          }}
        >
          <button
            onClick={closeInstallModal}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <BrandLogo size={60} rounded={16} />
          </div>

          <h3
            style={{
              fontSize: '22px',
              fontWeight: 700,
              fontFamily: "var(--ow-serif, Georgia, serif)",
              margin: '0 0 6px',
              color: '#FFFFFF',
            }}
          >
            {appTitle}
          </h3>
          <p
            style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={14} color="#FDE68A" />
            {isIpad ? 'iPad Tablet Optimized' : isIos ? 'Native iOS Experience' : isAndroid ? 'Android PWA Installation' : 'Progressive Web App'}
          </p>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {isInstalled ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <CheckCircle size={48} color="#2E7D32" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '18px', fontWeight: 600, color: '#30251F', marginBottom: '8px' }}>
                App Already Installed!
              </h4>
              <p style={{ fontSize: '14px', color: '#706053' }}>
                Crumb &amp; Co. is already running directly on your device. Launch it anytime from your home screen or dock.
              </p>
            </div>
          ) : isIos ? (
            /* iOS iPad / iPhone Step-by-Step Instructions */
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FAF0E6',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  border: '1px solid rgba(173, 100, 46, 0.25)',
                }}
              >
                {isIpad ? <Tablet size={20} color="#AD642E" /> : <Smartphone size={20} color="#AD642E" />}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#AD642E' }}>
                  3 Steps for Apple Safari ({isIpad ? 'iPad' : 'iPhone'}):
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: '#AD642E',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#30251F', margin: '0 0 2px' }}>
                      Tap the Share Button <Share size={15} style={{ display: 'inline', verticalAlign: 'middle', color: '#007AFF' }} />
                    </p>
                    <p style={{ fontSize: '12px', color: '#86766A', margin: 0 }}>
                      Located in the {isIpad ? 'top navigation bar' : 'bottom navigation bar'} in Apple Safari.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: '#AD642E',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#30251F', margin: '0 0 2px' }}>
                      Tap "Add to Home Screen" <PlusSquare size={15} style={{ display: 'inline', verticalAlign: 'middle', color: '#007AFF' }} />
                    </p>
                    <p style={{ fontSize: '12px', color: '#86766A', margin: 0 }}>
                      Scroll down the Apple share sheet menu and select the Add to Home Screen option.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: '#AD642E',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#30251F', margin: '0 0 2px' }}>
                      Confirm & Tap "Add"
                    </p>
                    <p style={{ fontSize: '12px', color: '#86766A', margin: 0 }}>
                      Tap "Add" in the top-right corner to place {appTitle} on your device home screen.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Android / Desktop / Chrome / Edge */
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#706053', marginBottom: '20px', lineHeight: 1.6 }}>
                {appDescription}
              </p>
              {canPromptNatively ? (
                <button
                  onClick={promptInstall}
                  style={{
                    backgroundColor: '#AD642E',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 28px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(173, 100, 46, 0.3)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#935122')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#AD642E')}
                >
                  <Download size={18} />
                  <span>Download &amp; Install App Now</span>
                </button>
              ) : (
                <div style={{ backgroundColor: '#FAF6F0', padding: '16px', borderRadius: '10px', textAlign: 'left', border: '1px solid #E8E0D7' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#30251F', marginBottom: '4px' }}>
                    Browser Install Tip ({isAndroid ? 'Android Chrome' : 'Desktop Browser'}):
                  </p>
                  <p style={{ fontSize: '12px', color: '#706053', margin: 0, lineHeight: 1.5 }}>
                    Tap the <strong>⋮ (Menu)</strong> icon in your browser and choose <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong> to install Crumb &amp; Co. instantly.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Feature Highlights */}
          <div
            style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #E8E0D7',
              display: 'flex',
              justifyContent: 'space-around',
              textAlign: 'center',
            }}
          >
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#30251F', margin: '0 0 2px' }}>⚡ Instant Launch</p>
              <p style={{ fontSize: '10px', color: '#86766A', margin: 0 }}>No App Store Delay</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#30251F', margin: '0 0 2px' }}>📱 Full Screen</p>
              <p style={{ fontSize: '10px', color: '#86766A', margin: 0 }}>Native App Feel</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#30251F', margin: '0 0 2px' }}>📶 Offline Resilient</p>
              <p style={{ fontSize: '10px', color: '#86766A', margin: 0 }}>Cached App Shell</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallModal;
