import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  BookOpen,
  ShoppingBag,
  Clock,
  User,
  ClipboardList,
  Flame,
  Layers,
  ChefHat,
  RefreshCw,
  LayoutDashboard,
  CalendarCheck,
  Package,
  Menu as MenuIcon
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useBusiness } from '../../context/BusinessContext';
import './MobileBottomNav.css';

/**
 * MobileBottomNav
 * 
 * Provides native mobile bottom bar navigation for Customer, Worker (Staff), and Owner roles.
 * Supports badges, active states, safe-area insets, and >=44px touch targets.
 */
const MobileBottomNav = ({ role = 'customer', onStationAction, isRefreshing = false, onMoreClick, isMenuOpen = false }) => {
  const { totalItemCount } = useCart();
  const { slug } = useBusiness();
  const location = useLocation();

  // Helper to build tenant-scoped navigation path for customers
  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  if (role === 'customer') {
    return (
      <nav className="mobile-bottom-nav" aria-label="Customer mobile navigation">
        <NavLink
          to={bPath('/')}
          end
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <Home size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Home</span>
        </NavLink>

        <NavLink
          to={bPath('/menu')}
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <BookOpen size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Menu</span>
        </NavLink>

        <NavLink
          to={bPath('/cart')}
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <ShoppingBag size={20} />
            {totalItemCount > 0 && (
              <span className="mobile-bottom-nav-badge">{totalItemCount}</span>
            )}
          </div>
          <span className="mobile-bottom-nav-label">Cart</span>
        </NavLink>

        <NavLink
          to={bPath('/orders')}
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <Clock size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Orders</span>
        </NavLink>

        <NavLink
          to={bPath('/profile')}
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <User size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Profile</span>
        </NavLink>
      </nav>
    );
  }

  if (role === 'staff') {
    return (
      <nav className="mobile-bottom-nav" aria-label="Staff kitchen navigation">
        <NavLink
          to="/staff/tasks"
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <ClipboardList size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Tasks</span>
        </NavLink>

        <NavLink
          to="/staff/production"
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <Flame size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Baking</span>
        </NavLink>

        <NavLink
          to="/staff/batches"
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <Layers size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Wastage</span>
        </NavLink>

        <button
          type="button"
          onClick={onStationAction}
          className={`mobile-bottom-nav-item ${isRefreshing ? 'active' : ''}`}
          title="Refresh & sync kitchen station"
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </div>
          <span className="mobile-bottom-nav-label">{isRefreshing ? 'Syncing...' : 'Sync Station'}</span>
        </button>
      </nav>
    );
  }

  if (role === 'owner') {
    return (
      <nav className="mobile-bottom-nav" aria-label="Owner dashboard navigation">
        <NavLink
          to="/owner/dashboard"
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <LayoutDashboard size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Dashboard</span>
        </NavLink>

        <NavLink
          to="/owner/orders"
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <ShoppingBag size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Orders</span>
        </NavLink>

        <NavLink
          to="/owner/production"
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <CalendarCheck size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Batches</span>
        </NavLink>

        <NavLink
          to="/owner/stock"
          className={({ isActive }) => `mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <Package size={20} />
          </div>
          <span className="mobile-bottom-nav-label">Stock</span>
        </NavLink>

        <button
          type="button"
          onClick={onMoreClick}
          className={`mobile-bottom-nav-item ${isMenuOpen ? 'active' : ''}`}
          aria-expanded={isMenuOpen}
          aria-label="Toggle owner menu drawer"
        >
          <div className="mobile-bottom-nav-icon-wrapper">
            <MenuIcon size={20} />
          </div>
          <span className="mobile-bottom-nav-label">More</span>
        </button>
      </nav>
    );
  }

  return null;
};

export default MobileBottomNav;

