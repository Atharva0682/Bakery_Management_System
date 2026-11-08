import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import {
  ChefHat,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Clock,
  Shield,
  Sparkles,
  CheckCircle2,
  LogOut,
  User,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import BrandLogo from '../../components/common/BrandLogo';

const StaffLoginPage = () => {
  const { login, logout, user, isAuthenticated } = useAuth();
  const { name: businessName } = useBusiness?.() || {};
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userRole = (user?.role || '').toLowerCase();
  const isWorkerAuthenticated = isAuthenticated && (userRole === 'baker' || userRole === 'staff');
  const isCustomerAuthenticated = isAuthenticated && userRole === 'customer';
  const isOwnerAuthenticated = isAuthenticated && (userRole === 'owner' || userRole === 'manager');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(identifier, password, 'crumbandco');
      if (res.success) {
        const role = (res.user?.role || '').toLowerCase();
        if (role === 'customer') {
          // Reject customer accounts on staff portal and reset session
          logout();
          setError('Customer accounts cannot access the Baker & Staff Portal. Please sign in with your staff credentials, or return to the Storefront.');
          setLoading(false);
          return;
        }
        if (role === 'owner' || role === 'manager') {
          navigate('/owner/dashboard');
        } else {
          navigate('/staff/tasks');
        }
      } else {
        setError(res.message || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (email, roleLabel) => {
    setIdentifier(email);
    setPassword('Password@123');
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FDFBF7',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px 16px'
    }}>
      {/* Brand Card */}
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid #EAE3D9',
        boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
        padding: '36px 32px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <BrandLogo size={56} rounded={16} />
          </div>

          <div style={{
            display: 'inline-block',
            backgroundColor: '#FEF3C7',
            color: '#92400E',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '20px',
            marginBottom: '8px'
          }}>
            {(businessName || 'Crumb & Co.').toUpperCase()} • STAFF PWA
          </div>

          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1A1615',
            margin: '0 0 6px'
          }}>
            Baker &amp; Staff Portal
          </h1>
          <p style={{ fontSize: '13px', color: '#736B63', margin: 0 }}>
            Kitchen production tasks, floor inventory, and active baking stations.
          </p>
        </div>

        {/* Existing Session Information / Switcher */}
        {isWorkerAuthenticated && (
          <div style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#166534',
            padding: '14px 16px',
            borderRadius: '12px',
            fontSize: '12px',
            marginBottom: '20px'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>
              ✓ You are currently signed in as {user?.name} ({userRole === 'baker' ? 'Head Baker' : 'Staff'}).
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => navigate('/staff/tasks')}
                style={{
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Go to Kitchen Tasks →
              </button>
              <button
                type="button"
                onClick={() => logout()}
                style={{
                  backgroundColor: 'transparent',
                  color: '#166534',
                  border: '1px solid #86EFAC',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {isCustomerAuthenticated && (
          <div style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #FDE68A',
            color: '#92400E',
            padding: '14px 16px',
            borderRadius: '12px',
            fontSize: '12px',
            marginBottom: '20px'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>
              Signed in as Customer ({user?.name})
            </div>
            <div>
              Staff operations require bakery employee credentials. Sign in with your staff account below or switch accounts.
            </div>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                marginTop: '10px',
                backgroundColor: 'transparent',
                color: '#92400E',
                border: '1px solid #D97706',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign Out from Customer Account
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
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
            <span>{error}</span>
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
              color: '#1A1615',
              marginBottom: '6px'
            }}>
              User Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="#A8A29E" style={{ position: 'absolute', left: '12px', top: '13px' }} />
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
                  border: '1px solid #D6C7B7',
                  fontSize: '13px',
                  color: '#1A1615',
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
              color: '#1A1615',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#A8A29E" style={{ position: 'absolute', left: '12px', top: '13px' }} />
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
                  border: '1px solid #D6C7B7',
                  fontSize: '13px',
                  color: '#1A1615',
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
                  color: '#736B63',
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
                setIdentifier('baker@crumbco.com');
                setPassword('Password@123');
                setError('');
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FDE68A',
                color: '#92400E',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FDE68A')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FEF3C7')}
            >
              <KeyRound size={13} />
              <span>Auto-Fill Demo Baker (baker@crumbco.com)</span>
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
              boxShadow: '0 2px 8px rgba(194, 94, 0, 0.25)',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Authenticating Staff...' : (
              <>
                <span>Access Production Floor</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Return Link */}
      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#736B63' }}>
        <a href="/" style={{ color: '#C25E00', textDecoration: 'none', fontWeight: 600 }}>
          ← Return to Customer Storefront
        </a>
      </div>
    </div>
  );
};

export default StaffLoginPage;
