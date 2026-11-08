import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import {
  ChefHat,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  LogOut,
  ShoppingBag,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import BrandLogo from '../../components/common/BrandLogo';

const OwnerLoginPage = () => {
  const { login, user, isAuthenticated, logout } = useAuth();
  const { business, name: businessName, logo: businessLogo } = useBusiness?.() || {};
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userRole = (user?.role || '').toLowerCase();

  // If already authenticated as worker/staff, show clear switcher
  if (isAuthenticated && (userRole === 'baker' || userRole === 'staff')) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#1C1917',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#FAFAF9'
      }}>
        <div style={{
          maxWidth: '440px',
          width: '100%',
          backgroundColor: '#292524',
          borderRadius: '20px',
          border: '1px solid #7F1D1D',
          padding: '36px 32px',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: '#450A0A',
            color: '#EF4444',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <AlertCircle size={30} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
            Restricted to Bakery Owners
          </h2>
          <p style={{ fontSize: '13px', color: '#A8A29E', margin: '0 0 24px', lineHeight: 1.5 }}>
            You are logged in as <strong>{user?.name}</strong> ({userRole}).
            Workers cannot access the Owner Operations Portal.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/staff/tasks')}
              style={{
                backgroundColor: '#C25E00',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to Staff Floor
            </button>
            <button
              onClick={() => logout()}
              style={{
                backgroundColor: 'transparent',
                color: '#D6D3D1',
                border: '1px solid #57534E',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated as customer, show clear switcher
  if (isAuthenticated && userRole === 'customer') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#1C1917',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#FAFAF9'
      }}>
        <div style={{
          maxWidth: '440px',
          width: '100%',
          backgroundColor: '#292524',
          borderRadius: '20px',
          border: '1px solid #57534E',
          padding: '36px 32px',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: '#44403C',
            color: '#F59E0B',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <ShieldCheck size={30} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
            Owner Access Required
          </h2>
          <p style={{ fontSize: '13px', color: '#A8A29E', margin: '0 0 24px', lineHeight: 1.5 }}>
            You are logged in as customer <strong>{user?.name}</strong>. Customer accounts cannot access the Executive Owner Portal.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                backgroundColor: '#57534E',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to Storefront
            </button>
            <button
              onClick={() => logout()}
              style={{
                backgroundColor: '#C25E00',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign In as Owner
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If already logged in as Owner, redirect directly to dashboard
  if (isAuthenticated && (userRole === 'owner' || userRole === 'manager')) {
    return <Navigate to="/owner/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(identifier, password, 'crumbandco');
      if (res.success) {
        const role = (res.user?.role || '').toLowerCase();
        if (role === 'customer') {
          logout();
          setError('Customer accounts cannot access the Owner Portal. Please sign in with Owner credentials or return to the Storefront.');
          setLoading(false);
          return;
        }
        if (role === 'baker' || role === 'staff') {
          navigate('/staff/tasks');
          return;
        }
        if (role === 'owner' || role === 'manager') {
          navigate('/owner/dashboard');
          return;
        }
        navigate('/');
      } else {
        setError(res.message || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1C1917',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px 16px'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: '#292524',
        borderRadius: '20px',
        border: '1px solid #44403C',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        padding: '36px 32px',
        color: '#FAFAF9'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <BrandLogo size={60} rounded={16} />
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#44403C',
            color: '#F59E0B',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            padding: '4px 14px',
            borderRadius: '20px',
            marginBottom: '10px'
          }}>
            <ShieldCheck size={14} color="#F59E0B" />
            {(businessName || 'CRUMB & CO.').toUpperCase()} • OWNER PORTAL
          </div>

          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#FAFAF9',
            margin: '0 0 6px'
          }}>
            Executive Management Login
          </h1>
          <p style={{ fontSize: '13px', color: '#A8A29E', margin: 0 }}>
            Executive oversight, batch feasibility, P&amp;L analytics, and operations management.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            backgroundColor: '#450A0A',
            border: '1px solid #991B1B',
            color: '#FCA5A5',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            lineHeight: '1.4',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div>{error}</div>
              {(error.includes('worker') || error.includes('Baker') || error.includes('Staff')) && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/staff/login')}
                    style={{
                      backgroundColor: '#C25E00',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    👉 Switch to Baker &amp; Staff Portal
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#D6D3D1',
              marginBottom: '6px'
            }}>
              User Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="#78716C" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="User Email"
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 36px',
                  borderRadius: '10px',
                  border: '1px solid #57534E',
                  backgroundColor: '#1C1917',
                  fontSize: '13px',
                  color: '#FAFAF9',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#D6D3D1',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#78716C" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 36px',
                  borderRadius: '10px',
                  border: '1px solid #57534E',
                  backgroundColor: '#1C1917',
                  fontSize: '13px',
                  color: '#FAFAF9',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#A8A29E',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Quick Demo Credential Pill */}
          <div style={{ marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => {
                setIdentifier('owner@crumbco.com');
                setPassword('Password@123');
                setError('');
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#F59E0B',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.18)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)')}
            >
              <KeyRound size={13} />
              <span>Auto-Fill Demo Owner (owner@crumbco.com)</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: '#C25E00',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 10px rgba(194, 94, 0, 0.4)',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Verifying Credentials...' : (
              <>
                <span>Enter Operations Command</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Return Link */}
      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#78716C' }}>
        <a href="/" style={{ color: '#F59E0B', textDecoration: 'none', fontWeight: 600 }}>
          ← Return to Customer Storefront
        </a>
      </div>
    </div>
  );
};

export default OwnerLoginPage;
