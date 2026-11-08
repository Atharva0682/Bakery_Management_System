import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, MapPin, LogIn, LogOut, User } from 'lucide-react';
import PwaInstallButton from './PwaInstallButton';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useQr } from '../../context/QrContext';
import BrandLogo from './BrandLogo';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const { totalItemCount } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const { name, logo, slug } = useBusiness();
  const { locationTag, hasTableContext } = useQr();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper to build tenant-scoped navigation path
  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate(bPath('/login'));
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to={bPath('/')} className="brand-logo" onClick={() => setMobileMenuOpen(false)}>
            <BrandLogo size={36} rounded={10} />
            <span className="brand-name">
              {name || 'Crumb&Co.'}
            </span>
          </Link>

          {/* Active Station / Table Context Badge */}
          {hasTableContext && locationTag && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-brand-primary)',
                backgroundColor: 'rgba(90, 56, 37, 0.08)',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: '1px solid rgba(90, 56, 37, 0.15)',
              }}
              title="Ordering from this station"
            >
              <MapPin size={12} />
              {locationTag}
            </span>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav">
          <NavLink
            to={bPath('/')}
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Home
          </NavLink>
          <NavLink
            to={bPath('/menu')}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Menu
          </NavLink>
          <NavLink
            to={bPath('/orders')}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Orders
          </NavLink>
          <NavLink
            to={bPath('/profile')}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Profile
          </NavLink>
        </nav>

        {/* Right Action Icons (Cart & Profile/Login & Install App) */}
        <div className="header-actions">
          {/* PWA Download / Install App Action */}
          <PwaInstallButton variant="header" />

          {/* Cart Icon with Counter Badge */}
          <Link to={bPath('/cart')} className="cart-btn" aria-label="Shopping Cart">
            <span className="cart-label">Cart</span>
            <div className="cart-icon-wrapper">
              <ShoppingBag size={20} strokeWidth={2} />
              {totalItemCount > 0 && (
                <span className="cart-badge">{totalItemCount}</span>
              )}
            </div>
          </Link>

          {/* Authenticated Customer Avatar or Log In button */}
          {isAuthenticated ? (
            <Link
              to={bPath('/profile')}
              className="profile-pill"
              title={user?.name || 'Customer Account'}
              style={{ textDecoration: 'none' }}
            >
              <span className="profile-label">
                {user?.name ? user.name.split(' ')[0] : 'Profile'}
              </span>
              <div className="avatar-circle">
                {user?.initials || 'U'}
              </div>
            </Link>
          ) : (
            <Link
              to={bPath('/login')}
              className="btn btn-primary btn-pill"
              style={{
                padding: '7px 18px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
              }}
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </Link>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer">
          <NavLink
            to={bPath('/')}
            end
            className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Home
          </NavLink>
          <NavLink
            to={bPath('/menu')}
            className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Menu
          </NavLink>
          <NavLink
            to={bPath('/cart')}
            className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Cart ({totalItemCount})
          </NavLink>

          <div style={{ padding: '8px 16px 12px' }}>
            <PwaInstallButton variant="pill" style={{ width: '100%', justifyContent: 'center' }} />
          </div>

          {isAuthenticated ? (
            <>
              <NavLink
                to={bPath('/orders')}
                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                My Orders
              </NavLink>
              <NavLink
                to={bPath('/profile')}
                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                My Account ({user?.name || 'Customer'})
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="mobile-nav-link"
                style={{
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  color: '#D32F2F',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <NavLink
                to={bPath('/login')}
                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </NavLink>
              <NavLink
                to={bPath('/signup')}
                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Create Account
              </NavLink>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
