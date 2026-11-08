import React from 'react';
import { Link } from 'react-router-dom';
import { Store, AlertTriangle, ArrowLeft } from 'lucide-react';

const BusinessNotFoundPage = ({ slug, error }) => {
  const isInactive = error?.type === 'INACTIVE' || error?.code === 'BUSINESS_INACTIVE';

  return (
    <div style={{ padding: '80px 0', textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: '520px' }}>
        <div className="card" style={{ padding: '48px 32px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: isInactive ? 'rgba(237, 108, 2, 0.1)' : 'rgba(211, 47, 47, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: isInactive ? 'var(--color-warning, #ED6C02)' : 'var(--color-error, #D32F2F)',
            }}
          >
            {isInactive ? <AlertTriangle size={36} /> : <Store size={36} />}
          </div>

          <h1 className="font-serif" style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '12px' }}>
            {isInactive ? 'Bakery Temporarily Inactive' : 'Bakery Not Found'}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', marginBottom: '28px' }}>
            {isInactive
              ? error?.message || `This bakery portal is currently inactive or undergoing maintenance. Please check back later.`
              : `We couldn't find any registered bakery with the URL slug "${slug}". Please check the QR code or link you scanned.`}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-primary btn-pill">
              <ArrowLeft size={16} /> Return to Bakery Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessNotFoundPage;
