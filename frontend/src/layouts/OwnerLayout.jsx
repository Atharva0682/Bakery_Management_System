import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import staffService from '../services/staffService';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Truck,
  CalendarCheck,
  Layers,
  Trash2,
  BookOpen,
  Users,
  DollarSign,
  Search,
  BarChart3,
  LogOut,
  Menu as MenuIcon,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChefHat,
  Palette,
  CreditCard
} from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';
import PwaInstallButton from '../components/common/PwaInstallButton';
import '../styles/owner-workspace.css';

const OwnerLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);

  const fetchHealth = async () => {
    try {
      const data = await staffService.getHealth();
      if (data && data.database) {
        setDbStatus(data.database);
      }
    } catch (err) {
      setDbStatus({
        connected: false,
        mode: 'unavailable',
        message: 'Cannot reach the backend database.'
      });
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/owner/login');
  };

  // Strict role check: Workers and customers cannot access Owner Operations
  const userRole = (user?.role || '').toLowerCase();
  const isAuthorizedOwner = userRole === 'owner' || userRole === 'manager';

  if (!user || !isAuthorizedOwner) {
    if (!user) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#FAF6F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#30251F',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <p style={{ color: '#5C4738', fontSize: '14px' }}>Verifying owner authorization...</p>
        </div>
      );
    }
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#FAF6F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#30251F',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E8E0D7',
          padding: '36px 32px',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 10px 25px -5px rgba(48, 37, 31, 0.08)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#FDF2F4',
            color: '#D86D8B',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px', color: '#30251F', fontFamily: "Georgia, serif" }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '13px', color: '#86766A', margin: '0 0 24px', lineHeight: 1.6 }}>
            You are signed in as <strong>{user?.name}</strong> ({userRole}).
            The Owner Operations Portal contains confidential business finances and master settings reserved strictly for the bakery owner.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate(userRole === 'baker' || userRole === 'staff' ? '/staff/tasks' : '/menu')}
              style={{
                backgroundColor: '#AD642E',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to Your Portal
            </button>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: 'transparent',
                color: '#5C4738',
                border: '1px solid #E8E0D7',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign Out &amp; Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const primaryNavItems = [
    { label: 'Dashboard', path: '/owner/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: 'Orders', path: '/owner/orders', icon: <ShoppingBag size={18} /> },
    { label: 'Production', path: '/owner/production', icon: <CalendarCheck size={18} /> },
    { label: 'Stock & Suppliers', path: '/owner/stock', icon: <Package size={18} /> },
    { label: 'Products & Recipes', path: '/owner/products', icon: <ChefHat size={18} /> },
    { label: 'Reports', path: '/owner/reports', icon: <BarChart3 size={18} /> },
  ];

  const secondaryNavItems = [
    { label: 'Team Management', path: '/owner/workers', icon: <Users size={16} /> },
    { label: 'Business & Branding', path: '/owner/branding', icon: <Palette size={16} /> },
  ];

  const initials = (user?.name || 'Owner')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="owner-shell">
      <header className="owner-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BrandLogo size={28} rounded={8} />
          <strong>Crumb &amp; Co.</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PwaInstallButton variant="header" />
          <button
            type="button"
            aria-label="Toggle owner navigation"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="owner-sidebar" data-open={mobileMenuOpen}>
        {/* Brand Header with White-Labelable Logo */}
        <div className="owner-sidebar-brand">
          <BrandLogo
            size={38}
            rounded={10}
            showName={true}
            subtitle="Owner Operations"
          />
        </div>

        {/* Navigation Items */}
        <div className="owner-sidebar-nav-container">
          <div>
            <div className="owner-sidebar-section-title">
              Operations
            </div>
            <div className="owner-sidebar-nav-list">
              {primaryNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `owner-sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div>
            <div className="owner-sidebar-section-title">
              Settings &amp; Team
            </div>
            <div className="owner-sidebar-nav-list">
              {secondaryNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `owner-sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Owner Identity & Logout */}
        <div className="owner-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div className="owner-sidebar-avatar">
                {initials || 'OW'}
              </div>
              <div>
                <div className="owner-sidebar-user-name">
                  {user?.name || 'Bakery Owner'}
                </div>
                <div className="owner-sidebar-user-role">
                  {user?.role === 'manager' ? 'Bakery Manager' : 'Bakery Owner'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="owner-sidebar-logout-btn"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <PwaInstallButton variant="pill" style={{ width: '100%', justifyContent: 'center' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href="/staff/tasks"
                className="owner-sidebar-action-btn"
              >
                <ChefHat size={13} /> Staff PWA
              </a>
              <a
                href="/"
                className="owner-sidebar-action-btn"
              >
                Storefront <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Content Outlet */}
        <main className="owner-main" style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default OwnerLayout;
