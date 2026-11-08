import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getBusinessBySlug } from '../services/customerService';

const BusinessContext = createContext();

// Configured default business slug for current customer client delivery
const DEFAULT_BUSINESS_SLUG = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'crumbandco';

export const BusinessProvider = ({ children, initialSlug = null }) => {
  const [slug, setSlug] = useState(
    initialSlug || localStorage.getItem('crumb_business_slug') || DEFAULT_BUSINESS_SLUG
  );
  const [business, setBusiness] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Applies dynamic CSS brand tokens based on active business
   */
  const applyBrandingStyles = (branding) => {
    if (!branding) return;
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty('--color-brand-primary', branding.primaryColor);
      root.style.setProperty('--color-brand-primary-hover', branding.primaryColor);
    }
    if (branding.secondaryColor) {
      root.style.setProperty('--color-brand-secondary', branding.secondaryColor);
    }
    if (branding.accentColor) {
      root.style.setProperty('--color-brand-accent', branding.accentColor);
    }
  };

  /**
   * Loads public business data from API
   */
  const loadBusiness = useCallback(async (targetSlug) => {
    const slugToFetch = targetSlug || slug || DEFAULT_BUSINESS_SLUG;
    setIsLoading(true);
    setError(null);

    try {
      const res = await getBusinessBySlug(slugToFetch);
      if (res && res.success && res.data) {
        const bizData = res.data;
        if (!bizData.isActive && bizData.is_active === false) {
          setError({
            type: 'INACTIVE',
            code: 'BUSINESS_INACTIVE',
            message: `Bakery '${bizData.name}' is currently unavailable or inactive.`,
          });
          setBusiness(null);
          return;
        }

        setBusiness(bizData);
        setSlug(bizData.slug);
        localStorage.setItem('crumb_business_slug', bizData.slug);
        applyBrandingStyles(bizData.branding);
      } else {
        throw new Error('Business data unavailable');
      }
    } catch (err) {
      const isNotFound = err.status === 404 || err.code === 'BUSINESS_NOT_FOUND';
      setError({
        type: isNotFound ? 'NOT_FOUND' : 'ERROR',
        code: err.code || (isNotFound ? 'BUSINESS_NOT_FOUND' : 'NETWORK_ERROR'),
        message: err.message || `Bakery business '${slugToFetch}' could not be loaded.`,
        slug: slugToFetch,
      });
      setBusiness(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Initial load or when slug changes
  useEffect(() => {
    if (slug) {
      loadBusiness(slug);
    }
  }, [slug, loadBusiness]);

  return (
    <BusinessContext.Provider
      value={{
        business,
        businessId: business?.id || null,
        slug: business?.slug || slug,
        name: business?.name || '',
        logo: business?.logoUrl || null,
        primaryColor: business?.branding?.primaryColor || '#5A3825',
        secondaryColor: business?.branding?.secondaryColor || '#8B5A2B',
        accentColor: business?.branding?.accentColor || '#D96C8A',
        currency: business?.currency || 'INR',
        currencySymbol: business?.currencySymbol || '₹',
        timezone: business?.timezone || 'Asia/Kolkata',
        contact: business?.contact || null,
        address: business?.address || null,
        upiVpa: business?.upiVpa || business?.upi_vpa || null,
        isLoading,
        error,
        loadBusiness,
        setSlug,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};

export default BusinessContext;
