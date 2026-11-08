import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import BrandLogo from '../components/common/BrandLogo';

const SignUpPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isAuthenticated } = useAuth();
  const { name, logo, slug } = useBusiness();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive tenant-scoped links
  const bPath = (path) => (slug ? `/b/${slug}${path === '/' ? '' : path}` : path);

  // If already authenticated, redirect to destination
  const fromDestination =
    location.state?.from?.pathname
      ? location.state.from.pathname + (location.state.from.search || '')
      : bPath('/');

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(fromDestination, { replace: true });
    }
  }, [isAuthenticated, fromDestination, navigate]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter your full name.');
      return;
    }

    if (!formData.phone.trim()) {
      setFormError('Please enter your mobile phone number.');
      return;
    }

    if (!formData.password) {
      setFormError('Please enter a password.');
      return;
    }

    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim(),
        password: formData.password,
        businessSlug: slug,
      });

      if (result.success) {
        navigate(fromDestination, { replace: true });
      } else {
        if (result.code === 'PHONE_EXISTS') {
          setFormError('An account with this phone number already exists. Please sign in instead.');
        } else if (result.code === 'EMAIL_EXISTS') {
          setFormError('An account with this email address already exists. Please sign in instead.');
        } else {
          setFormError(result.message || 'Unable to register account. Please check your details.');
        }
      }
    } catch (err) {
      setFormError(err.message || 'An unexpected error occurred during account creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const brandInitial = name ? name.trim().charAt(0).toUpperCase() : 'C';

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
      <div className="container" style={{ maxWidth: '480px' }}>
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
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
              Create Account
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary, #5E4E45)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Create an account for personalized ordering, delivery tracking, and order history.
            </p>
          </div>

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

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="signup-name"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #2E221D)',
                  marginBottom: '6px',
                }}
              >
                Full Name *
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
                  <User size={18} />
                </div>
                <input
                  id="signup-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Ananya Nair"
                  autoComplete="name"
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
                />
              </div>
            </div>

            {/* Phone Number */}
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="signup-phone"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #2E221D)',
                  marginBottom: '6px',
                }}
              >
                Mobile Phone Number *
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
                  <Phone size={18} />
                </div>
                <input
                  id="signup-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="e.g. +91 98201 54321"
                  autoComplete="tel"
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
                />
              </div>
            </div>

            {/* Email Address (Optional) */}
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="signup-email"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #2E221D)',
                  marginBottom: '6px',
                }}
              >
                Email Address <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
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
                  id="signup-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="e.g. ananya.nair@gmail.com"
                  autoComplete="email"
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
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="signup-password"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #2E221D)',
                  marginBottom: '6px',
                }}
              >
                Password *
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
                  <Lock size={18} />
                </div>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
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

            {/* Confirm Password */}
            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="signup-confirm-password"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #2E221D)',
                  marginBottom: '6px',
                }}
              >
                Confirm Password *
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
                  <Lock size={18} />
                </div>
                <input
                  id="signup-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
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
                />
              </div>
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Customer Account</span>
              )}
            </button>
          </form>

          {/* Switch to Login */}
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
            <span>Already have an account? </span>
            <Link
              to={bPath('/login')}
              state={{ from: location.state?.from }}
              style={{
                color: 'var(--color-brand-primary, #5A3825)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Sign In
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

export default SignUpPage;
