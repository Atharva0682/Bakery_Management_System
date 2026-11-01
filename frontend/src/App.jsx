import React, { useEffect, useState } from 'react';
import { ConfigProvider } from 'antd';
import { antdBakeryTheme } from './utils/theme';
import { BusinessProvider } from './context/BusinessContext';
import { QrProvider } from './context/QrContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { PwaProvider } from './context/PwaContext';
import PwaInstallModal from './components/common/PwaInstallModal';
import AppRoutes from './routes/AppRoutes';

function ConnectionNotice() {
  const [unavailable, setUnavailable] = useState(() => !navigator.onLine);
  useEffect(() => {
    const down = () => setUnavailable(true), up = () => setUnavailable(false);
    window.addEventListener('offline', down); window.addEventListener('crumb-api-unavailable', down);
    window.addEventListener('crumb-api-available', up);
    return () => { window.removeEventListener('offline', down); window.removeEventListener('crumb-api-unavailable', down); window.removeEventListener('crumb-api-available', up); };
  }, []);
  return unavailable ? <div role="status" style={{ padding: 12, background: '#FFFBEB', color: '#92400E', borderBottom: '1px solid #FCD34D' }}>Business service unavailable. Reconnect to load live records and save changes.</div> : null;
}
function App() {
  return (
    <ConfigProvider theme={antdBakeryTheme}>
      <ConnectionNotice />
      <BusinessProvider>
        <QrProvider>
          <AuthProvider>
            <CartProvider>
              <PwaProvider>
                <AppRoutes />
                <PwaInstallModal />
              </PwaProvider>
            </CartProvider>
          </AuthProvider>
        </QrProvider>
      </BusinessProvider>
    </ConfigProvider>
  );
}

export default App;
