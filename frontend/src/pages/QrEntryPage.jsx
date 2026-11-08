import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QrCode, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { resolveQrCode } from '../services/customerService';
import { useQr } from '../context/QrContext';
import { useBusiness } from '../context/BusinessContext';

const QrEntryPage = () => {
  const { uniqueCode } = useParams();
  const navigate = useNavigate();
  const { setQrContext } = useQr();
  const { setSlug, loadBusiness } = useBusiness();

  const [status, setStatus] = useState('resolving'); // 'resolving' | 'success' | 'error'
  const [errorInfo, setErrorInfo] = useState(null);
  const [resolvedData, setResolvedData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const resolve = async () => {
      if (!uniqueCode) {
        setStatus('error');
        setErrorInfo({ code: 'QR_MISSING', message: 'No QR code provided.' });
        return;
      }

      setStatus('resolving');
      try {
        const res = await resolveQrCode(uniqueCode);
        if (!isMounted) return;

        if (res && res.success && res.data) {
          const qrData = res.data;
          setResolvedData(qrData);
          setStatus('success');

          // 1. Store in QrContext
          setQrContext(qrData);

          const defaultSlug = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'crumbandco';
          const bizSlug = qrData.business?.slug || defaultSlug;
          setSlug(bizSlug);
          await loadBusiness(bizSlug);

          // 3. Determine target route based on qrType
          let targetPath = `/b/${bizSlug}/menu`;
          if (qrData.qrType === 'direct_payment') {
            targetPath = `/b/${bizSlug}/checkout`;
          } else if (qrData.qrType === 'table_order' && qrData.locationTag) {
            targetPath = `/b/${bizSlug}/menu?table=${encodeURIComponent(qrData.locationTag)}`;
          }

          // Small delay so user sees confirmation
          setTimeout(() => {
            if (isMounted) {
              navigate(targetPath, { replace: true });
            }
          }, 800);
        } else {
          throw new Error('Could not resolve QR code.');
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus('error');
        setErrorInfo({
          code: err.code || 'QR_ERROR',
          message: err.message || `Unable to resolve QR code "${uniqueCode}".`,
        });
      }
    };

    resolve();

    return () => {
      isMounted = false;
    };
  }, [uniqueCode, navigate, setQrContext, setSlug, loadBusiness]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app, #FAF6F0)',
        padding: '24px',
      }}
    >
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '40px 28px', textAlign: 'center' }}>
        {status === 'resolving' && (
          <div>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-brand-primary-light, #FDF2F4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: 'var(--color-brand-primary)',
              }}
            >
              <QrCode size={32} />
            </div>
            <h2 className="font-serif" style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Verifying QR Code
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Connecting to Crumb & Co. order station...
            </p>
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid var(--border-light, #EFE6DC)',
                borderTopColor: 'var(--color-brand-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
              }}
            />
          </div>
        )}

        {status === 'success' && resolvedData && (
          <div>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: 'var(--color-success, #2E7D32)',
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <h2 className="font-serif" style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              {resolvedData.business?.name || 'Crumb & Co.'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '16px' }}>
              {resolvedData.locationTag
                ? `Welcome! Connected to ${resolvedData.locationTag}.`
                : 'QR verified! Redirecting to menu...'}
            </p>
            {resolvedData.locationTag && (
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: 'var(--color-brand-primary-light, #FDF2F4)',
                  color: 'var(--color-brand-primary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '4px 14px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(216, 109, 139, 0.25)',
                }}
              >
                Table Station: {resolvedData.locationTag}
              </span>
            )}
          </div>
        )}

        {status === 'error' && (
          <div>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: 'var(--color-error, #D32F2F)',
              }}
            >
              <AlertCircle size={36} />
            </div>
            <h2 className="font-serif" style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Invalid QR Code
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
              {errorInfo?.message || 'This QR code is either invalid, inactive, or belongs to an unlisted bakery.'}
            </p>
            <Link to="/" className="btn btn-primary btn-pill">
              <ArrowLeft size={16} /> Go to Bakery Home
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default QrEntryPage;
