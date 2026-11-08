import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle2, User, LogOut, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import BrandLogo from '../components/common/BrandLogo';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, isAuthenticated, user } = useAuth();
  const { name, logo, slug } = useBusiness();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive tenant-scoped links
  const bPath = (path) => (slug ? `/b/${slug}${path === '/' ? '' : path}` : path);

  // If already authenticated as customer, redirect to destination
  const fromDestination =
    location.state?.from?.pathname
      ? location.state.from.pathname + (location.state.from.search || '')
      : bPath('/');

  const userRole = (user?.role || '').toLowerCase();
  const isNonCustomerSession =
    isAuthenticated && (userRole === 'baker' || userRole === 'staff' || userRole === 'owner' || userRole === 'manager');

  React.useEffect(() => {
    // Only auto-redirect if authenticated as a customer
    if (isAuthenticated && userRole === 'customer') {
      navigate(fromDestination, { replace: true });
    }
  }, [isAuthenticated, userRole, fromDestination, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!identifier.trim()) {
      setFormError('Please enter your email address or phone number.');
      return;
    }

    if (!password) {
      setFormError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(identifier.trim(), password, slug);
      if (result.success) {
        const newRole = (result.user?.role || '').toLowerCase();
        if (newRole === 'owner' || newRole === 'manager') {
          navigate('/owner/dashboard', { replace: true });
        } else if (newRole === 'baker' || newRole === 'staff') {
          navigate('/staff/tasks', { replace: true });
        } else {
          navigate(fromDestination || bPath('/'), { replace: true });
        }
      } else {
        setFormError(result.message || 'Invalid email/phone or password. Please try again.');
      }
    } catch (err) {
      setFormError(err.message || 'An unexpected error occurred during sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'baker':
        return 'Head Baker';
      case 'staff':
        return 'Kitchen Staff';
      case 'owner':
        return 'Bakery Owner';
      case 'manager':
        return 'Manager';
      default:
        return 'Staff Member';
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas, #FAF6F0)',
        minHeight: 'calc(100vh - var(--header-height, 80px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px 80px',
      }}
    >
      <div className="container" style={{ maxWidth: '440px' }}>
        <div
          className="card"
          style={{
            padding: '36px 32px',
            borderRadius: '20px',
            boxShadow: '0 8px 30px rgba(90, 56, 37, 0.08)',
            border: '1px solid var(--border-medium, #E8DFD5)',
            backgroundColor: '#FFFFFF',
          }}
        >
          {/* Brand Logo & Name Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <Link
              to={bPath('/')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                textDecoration: 'none',
                marginBottom: '16px',
              }}
            >
              <BrandLogo size={44} rounded={12} />
              <span
                style={{
                  fontFamily: 'var(--font-serif, "Playfair Display", Georgia, serif)',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #2E221D)',
                  letterSpacing: '-0.3px',
                }}
              >
                {name || 'Crumb & Co.'}
              </span>
            </Link>

            <h1
              className="font-serif"
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text-primary, #2E221D)',
                marginBottom: '8px',
              }}
            >
              Welcome Back
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary, #5E4E45)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Sign in to manage your orders, delivery addresses, and rewards.
            </p>
          </div>

          {/* Active Work Session Switcher Card */}
          {isNonCustomerSession && (
            <div
              style={{
                backgroundColor: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: '14px',
                padding: '16px',
                marginBottom: '22px',
                color: '#92400E',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 700 }}>
                <User size={16} />
                <span>Currently signed in as {user?.name}</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12px', lineHeight: 1.5, color: '#78350F' }}>
                You are authenticated as <strong>{getRoleLabel(userRole)}</strong>. To place personal orders or manage your customer profile, you can sign in with your customer account below or switch accounts.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => navigate(userRole === 'owner' || userRole === 'manager' ? '/owner/dashboard' : '/staff/tasks')}
                  style={{
                    backgroundColor: '#B45309',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Go to Work Portal</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#92400E',
                    border: '1px solid #D97706',
                    borderRadius: '8px',
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Alert Banner */}
          {formError && (
            <div
              style={{
                backgroundColor: '#FDECEA',
                color: '#D32F2F',
                border: '1px solid #FFCDD2',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '20px',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{formError}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Identifier Input (Email or Phone) */}
            <div style={{ marginBottom: '18px' }}>
              <label
                htmlFor="customer-identifier"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #2E221D)',
                  marginBottom: '6px',
                }}
              >
                Email or Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted, #9E8E84)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Mail size={18} />
                </div>
                <input
                  id="customer-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="User Email or Phone"
                  autoComplete="username"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    fontSize: '14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium, #E8DFD5)',
                    backgroundColor: 'var(--bg-surface-soft, #FAF6F0)',
                    color: 'var(--text-primary, #2E221D)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-brand-primary, #5A3825)';
                    e.target.style.backgroundColor = '#FFFFFF';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-medium, #E8DFD5)';
                    e.target.style.backgroundColor = 'var(--bg-surface-soft, #FAF6F0)';
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <label
                  htmlFor="customer-password"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #2E221D)',
                  }}
                >
                  Password
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted, #9E8E84)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Lock size={18} />
                </div>
                <input
                  id="customer-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 42px',
                    fontSize: '14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium, #E8DFD5)',
                    backgroundColor: 'var(--bg-surface-soft, #FAF6F0)',
                    color: 'var(--text-primary, #2E221D)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-brand-primary, #5A3825)';
                    e.target.style.backgroundColor = '#FFFFFF';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-medium, #E8DFD5)';
                    e.target.style.backgroundColor = 'var(--bg-surface-soft, #FAF6F0)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #9E8E84)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Quick Demo Credential Pill */}
            <div style={{ marginTop: '2px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setIdentifier('customer@crumbco.com');
                  setPassword('Password@123');
                  setFormError('');
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(90, 56, 37, 0.06)',
                  border: '1px solid rgba(90, 56, 37, 0.15)',
                  color: 'var(--color-brand-primary, #5A3825)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(90, 56, 37, 0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(90, 56, 37, 0.06)')}
              >
                <KeyRound size={13} />
                <span>Auto-Fill Demo Customer (customer@crumbco.com)</span>
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-pill"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.8 : 1,
              }}
            >
              {isSubmitting ? (
                <>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#FFFFFF',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In as Customer</span>
              )}
            </button>
          </form>

          {/* Switch to Sign Up */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-light, #EFE6DC)',
              fontSize: '14px',
              color: 'var(--text-secondary, #5E4E45)',
            }}
          >
            <span>Don't have an account? </span>
            <Link
              to={bPath('/signup')}
              state={{ from: location.state?.from }}
              style={{
                color: 'var(--color-brand-primary, #5A3825)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Sign Up
            </Link>
          </div>

          {/* Return to Menu Link */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <Link
              to={bPath('/menu')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--text-muted, #9E8E84)',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} /> Continue browsing menu
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
