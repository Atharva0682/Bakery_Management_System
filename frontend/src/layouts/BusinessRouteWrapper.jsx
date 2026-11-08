import React, { useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { useBusiness } from '../context/BusinessContext';
import BusinessNotFoundPage from '../pages/BusinessNotFoundPage';
import CustomerLayout from './CustomerLayout';

const BusinessRouteWrapper = () => {
  const { businessSlug } = useParams();
  const { slug, business, isLoading, error, loadBusiness, setSlug } = useBusiness();

  const defaultSlug = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'crumbandco';
  const targetSlug = businessSlug || defaultSlug;

  useEffect(() => {
    const activeTarget = businessSlug || defaultSlug;
    if (activeTarget && activeTarget !== slug) {
      setSlug(activeTarget);
      loadBusiness(activeTarget);
    }
  }, [businessSlug, defaultSlug, slug, loadBusiness, setSlug]);

  if (isLoading && !business && !error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app, #FAF6F0)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--border-light, #EFE6DC)',
            borderTopColor: 'var(--color-brand-primary, #5A3825)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px',
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ color: 'var(--text-secondary, #5E4E45)', fontSize: '15px' }}>
          Loading bakery catalog...
        </p>
      </div>
    );
  }

  if (error) {
    return <BusinessNotFoundPage slug={targetSlug} error={error} />;
  }

  return <CustomerLayout />;
};

export default BusinessRouteWrapper;
