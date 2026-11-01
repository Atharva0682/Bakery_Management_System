import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Clock, MapPin, Phone, User, Package, Calendar, RefreshCw, ShoppingBag } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';
import * as customerService from '../services/customerService';
import { formatCurrency } from '../utils/formatters';

const OrderConfirmationPage = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currency, slug, name: businessName } = useBusiness();

  const tokenFromUrl = searchParams.get('t') || searchParams.get('token') || '';
  const storedToken = orderId ? (localStorage.getItem(`crumb_order_token_${orderId}`) || '') : '';
  const token = tokenFromUrl || storedToken;

  const [order, setOrder] = useState(() => {
    if (location.state?.order) return location.state.order;
    try {
      const cached = localStorage.getItem('crumb_latest_order');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (String(parsed.order_no) === String(orderId) || String(parsed.id) === String(orderId)) {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  });

  const [isLoading, setIsLoading] = useState(!order);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // Persist token in localStorage for resilient reloads
    if (token && orderId) {
      localStorage.setItem(`crumb_order_token_${orderId}`, token);
    }

    const fetchOrder = async () => {
      try {
        const params = token ? { t: token } : {};
        const res = await customerService.getOrderById(orderId, params);
        if (isMounted && res && (res.success || res.data)) {
          const freshData = res.data || res;
          setOrder(freshData);
          localStorage.setItem('crumb_latest_order', JSON.stringify(freshData));
          if (freshData.tracking_token) {
            localStorage.setItem(`crumb_order_token_${freshData.order_no || freshData.id}`, freshData.tracking_token);
            localStorage.setItem(`crumb_order_token_${freshData.id}`, freshData.tracking_token);
          }
        }
      } catch (err) {
        console.warn('[OrderConfirmation] API fetch warning:', err.message);
        if (!order) {
          setError('Unable to load order confirmation details. Please check your order tracking link.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId, token]);

  const tokenQuery = token ? `?t=${encodeURIComponent(token)}` : '';
  const trackingUrl = slug
    ? `/b/${slug}/order-tracking/${order?.order_no || order?.id || orderId}${tokenQuery}`
    : `/order-tracking/${order?.order_no || order?.id || orderId}${tokenQuery}`;
  const menuUrl = slug ? `/b/${slug}/menu` : '/menu';

  if (isLoading) {
    return (
      <div style={{ maxWidth: '640px', margin: '60px auto', textAlign: 'center', padding: '32px' }}>
        <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--color-brand-primary, #5A3825)' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary, #2E221D)' }}>
          Preparing your order confirmation...
        </h2>
      </div>
    );
  }

  const items = order?.items || [];
  const paymentStatus = order?.payment_status || 'Pending Verification';
  const isPaid = paymentStatus === 'Paid' || paymentStatus === 'Verified';

  return (
    <div style={{ backgroundColor: 'var(--bg-canvas, #FAF6F0)', minHeight: '85vh', padding: '40px 16px 80px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        
        {/* Main Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--border-light, #E8E0D7)',
          padding: '36px 28px',
          boxShadow: '0 4px 16px rgba(48, 37, 31, 0.06)',
          textAlign: 'center'
        }}>
          
          {/* Success Check Badge */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#DCFCE7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            border: '2px solid #86EFAC'
          }}>
            <CheckCircle2 size={36} style={{ color: '#166534' }} />
          </div>

          <h1 style={{
            fontFamily: 'var(--ow-serif, Georgia, serif)',
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text-primary, #2E221D)',
            margin: '0 0 8px'
          }}>
            Order Placed Successfully!
          </h1>

          <p style={{
            color: 'var(--text-secondary, #6B5E55)',
            fontSize: '15px',
            margin: '0 auto 24px',
            maxWidth: '480px'
          }}>
            Thank you for ordering with {businessName || 'Crumb & Co.'}. Your fresh artisanal bake has been sent to our kitchen.
          </p>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
            <Link
              to={trackingUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 26px',
                backgroundColor: 'var(--color-brand-primary, #5A3825)',
                color: '#FFFFFF',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(90, 56, 37, 0.2)'
              }}
            >
              <span>Track Live Order Status</span>
              <ArrowRight size={16} />
            </Link>

            <Link
              to={menuUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: '#FAF6F0',
                color: 'var(--text-primary, #2E221D)',
                border: '1px solid #E8E0D7',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none'
              }}
            >
              <ShoppingBag size={16} />
              <span>Browse Menu</span>
            </Link>
          </div>

          {/* Key Details Summary Grid */}
          <div style={{
            backgroundColor: '#FAF6F0',
            borderRadius: '12px',
            border: '1px solid #EFE6DC',
            padding: '20px',
            textAlign: 'left',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8E7C72', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Order Number
              </span>
              <strong style={{ fontSize: '15px', color: '#2E221D', fontFamily: 'monospace' }}>
                #{order?.order_no || order?.id || orderId}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8E7C72', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Payment Status
              </span>
              <span style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: isPaid ? '#DCFCE7' : '#FEF3C7',
                color: isPaid ? '#166534' : '#92400E',
                border: `1px solid ${isPaid ? '#86EFAC' : '#FCD34D'}`
              }}>
                {paymentStatus}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8E7C72', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Delivery Slot
              </span>
              <strong style={{ fontSize: '13px', color: '#2E221D' }}>
                {order?.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Today'} · {order?.delivery_time_slot || 'Standard Shift'}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8E7C72', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Total Paid / Due
              </span>
              <strong style={{ fontSize: '16px', color: 'var(--color-brand-primary, #5A3825)' }}>
                {formatCurrency(order?.total_amount || 0, currency)}
              </strong>
            </div>
          </div>

          {/* Customer & Delivery Details */}
          {(order?.guest_name || order?.customer_name) && (
            <div style={{
              textAlign: 'left',
              borderTop: '1px solid #EFE6DC',
              paddingTop: '16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#5E4E45'
            }}>
              <div style={{ fontWeight: 600, color: '#2E221D', marginBottom: '4px' }}>
                Customer Contact
              </div>
              <div>{order.guest_name || order.customer_name} {order.guest_phone || order.customer_phone ? `(${order.guest_phone || order.customer_phone})` : ''}</div>
              {order.delivery_address && (
                <div style={{ marginTop: '4px', color: '#8E7C72' }}>
                  Address: {order.delivery_address}
                </div>
              )}
            </div>
          )}

          {/* Itemized Order Breakdown */}
          {items.length > 0 && (
            <div style={{ textAlign: 'left', borderTop: '1px solid #EFE6DC', paddingTop: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#2E221D', marginBottom: '10px' }}>
                Items in This Order ({items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#5E4E45' }}>
                    <span>
                      <strong>{item.quantity}x</strong> {item.product_name || item.name || 'Artisanal Baked Item'}
                    </span>
                    <span>{formatCurrency(Number(item.subtotal || (item.unit_price * item.quantity) || 0), currency)}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed #E8DFD5', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: '#2E221D' }}>
                <span>Grand Total</span>
                <span style={{ color: 'var(--color-brand-primary, #5A3825)' }}>
                  {formatCurrency(order?.total_amount || 0, currency)}
                </span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default OrderConfirmationPage;

