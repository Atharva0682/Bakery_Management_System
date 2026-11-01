import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import staffService from '../services/staffService';
import BrandLogo from '../components/common/BrandLogo';
import PwaInstallButton from '../components/common/PwaInstallButton';
import {
  ClipboardList,
  Package,
  Clock,
  Layers,
  LogOut,
  Flame,
  CheckCircle2,
  AlertCircle,
  Menu as MenuIcon,
  X,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  BookOpen
} from 'lucide-react';

const StaffLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      const data = await staffService.getHealth();
      if (data && data.database) {
        setDbStatus(data.database);
      }
    } catch (err) {
      setDbStatus({
        connected: false,
        mode: 'in-memory-fallback',
        message: 'Backend server is running in resilient in-memory mode.'
      });
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchHealth();
    window.dispatchEvent(new CustomEvent('crumbco:staff-refresh'));
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleLogout = () => {
    logout();
    navigate('/staff/login');
  };

  const navItems = [
    { label: "Today's Tasks", path: '/staff/tasks', icon: <ClipboardList size={17} /> },
    { label: 'Order Recipes & Baking', path: '/staff/production', icon: <Flame size={17} /> },
    { label: 'Wastage & Buffer', path: '/staff/batches', icon: <Layers size={17} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#FAF6F0' }}>
      {/* Staff Artisan PWA Header */}
      <header style={{
        backgroundColor: '#FAF6F0',
        color: '#30251F',
        padding: '0 28px',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #E8E0D7',
        boxShadow: '0 1px 4px rgba(48, 37, 31, 0.04)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        {/* Brand & Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <BrandLogo
            size={38}
            rounded={10}
            showName={true}
            subtitle="Bakery Floor · Kitchen Station"
          />

          {/* Desktop Nav Tabs */}
          <nav style={{ display: 'none', alignItems: 'center', gap: '6px' }} className="staff-desktop-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#AD642E' : '#706053',
                  backgroundColor: isActive ? 'rgba(173, 100, 46, 0.09)' : 'transparent',
                  border: isActive ? '1px solid rgba(173, 100, 46, 0.22)' : '1px solid transparent',
                  transition: 'all 0.15s ease'
                })}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right Section: Kitchen Status, Identity, Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Active Kitchen Floor Status Pill */}
          <div
            id="staff-header-status-pill"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#EDF3EB',
              border: '1px solid rgba(82, 116, 90, 0.25)',
              borderRadius: '20px',
              padding: '6px 14px'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#2E7D32',
              boxShadow: '0 0 6px rgba(46, 125, 50, 0.5)',
              display: 'inline-block'
            }} />
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#52745A'
            }}>
              Kitchen Station Active
            </span>
          </div>

          {/* PWA Install Button for Kitchen Display Tablet */}
          <PwaInstallButton variant="header" />

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            title="Sync kitchen tasks"
            disabled={isRefreshing}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #E8E0D7',
              backgroundColor: '#FFFFFF',
              color: '#706053',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>

          {/* Baker Identity Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#FFFFFF',
            padding: '4px 12px 4px 6px',
            borderRadius: '24px',
            border: '1px solid #E8E0D7',
            boxShadow: '0 1px 4px rgba(48, 37, 31, 0.04)'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#AD642E',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px'
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'B'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontWeight: 600, color: '#30251F', fontSize: '12px' }}>{user?.name || 'Baker'}</span>
              <span style={{ color: '#86766A', fontSize: '11px', textTransform: 'capitalize' }}>
                {user?.role === 'baker' ? 'Head Baker' : (user?.role || 'Staff')}
              </span>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #E8E0D7',
              backgroundColor: '#FFFFFF',
              color: '#706053',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <LogOut size={16} />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #E8E0D7',
              backgroundColor: '#FFFFFF',
              color: '#30251F',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            className="staff-mobile-toggle"
          >
            {mobileMenuOpen ? <X size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          backgroundColor: '#FAF6F0',
          borderBottom: '1px solid #E8E0D7',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#AD642E' : '#706053',
                backgroundColor: isActive ? 'rgba(173, 100, 46, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(173, 100, 46, 0.22)' : '1px solid transparent'
              })}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}

      {/* Main Staff Work Area */}
      <main style={{ flex: '1 0 auto', padding: '24px 28px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        padding: '14px 28px',
        borderTop: '1px solid #E8E0D7',
        fontSize: '12px',
        color: '#86766A',
        backgroundColor: '#FAF6F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>
          <strong>Crumb &amp; Co. Bakery Floor</strong> — Shift Operations Module ({user?.name || 'Baker'} · {user?.role === 'baker' ? 'Head Baker' : (user?.role || 'Staff')})
        </span>
        <span>Smart Bakery Management System</span>
      </footer>

      {/* Scoped CSS for responsive menu */}
      <style>{`
        @media (min-width: 900px) {
          .staff-desktop-nav {
            display: flex !important;
          }
          .staff-mobile-toggle {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default StaffLayout;
