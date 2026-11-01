import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Phone, HelpCircle, RefreshCw, AlertCircle, Loader2, ArrowLeft, MapPin, ShieldCheck, Utensils, Check, Upload, Calendar } from 'lucide-react';
import { ORDER_STAGES } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import customerService from '../services/customerService';

const STAGE_DESCRIPTIONS = {
  'Order Placed': 'Your order has been received and queued for the bakers.',
  'Accepted': 'Head baker reviewed and accepted the order requirements.',
  'In Production': 'Fresh dough is baking in our traditional deck ovens right now.',
  'Packaged': 'Handcrafted treats safely packed in eco-friendly bakery packaging.',
  'Out for Delivery': 'Your delivery hero is en route with your warm baked treats.',
  'Delivered': 'Order hand-delivered fresh and delicious. Enjoy every bite!',
};

export const normalizeCustomerStage = (rawStatus) => {
  if (!rawStatus) return { stageIndex: 0, normalizedStatus: 'Order Placed', subStage: null };
  const s = String(rawStatus).trim();

  if (s === 'Rejected' || s === 'Cancelled') {
    return { stageIndex: -1, normalizedStatus: s, subStage: null };
  }

  // 0: Order Placed
  if (['Order Placed', 'Pending', 'Pending Verification', 'Unverified'].includes(s)) {
    return {
      stageIndex: 0,
      normalizedStatus: 'Order Placed',
      subStage: s === 'Pending Verification' ? 'Awaiting Payment Verification' : null,
    };
  }

  // 1: Accepted
  if (['Accepted', 'Verified', 'Confirmed'].includes(s)) {
    return {
      stageIndex: 1,
      normalizedStatus: 'Accepted',
      subStage: 'Order Confirmed by Bakery',
    };
  }

  // 2: In Production (handles Preparation, Proofing, Baking, Cooling, In Progress, In Production, Product Completed)
  if (['In Production', 'In Progress', 'Preparation', 'Proofing', 'Baking', 'Cooling', 'Product Completed'].includes(s)) {
    let sub = 'Kitchen Production in Progress';
    if (s === 'Preparation') sub = 'Kitchen Prep & Weighing Ingredients';
    else if (s === 'Proofing') sub = 'Dough Proofing & Resting';
    else if (s === 'Baking') sub = 'Baking in Deck Ovens';
    else if (s === 'Cooling') sub = 'Cooling & Crust Setting';
    else if (s === 'Product Completed') sub = 'Baking Completed, Ready for Packaging';

    return {
      stageIndex: 2,
      normalizedStatus: 'In Production',
      subStage: sub,
    };
  }

  // 3: Packaged (Quality Check step removed, directly to Packaged)
  if (['Packaged', 'Packaging', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Quality Check', 'QC'].includes(s)) {
    return {
      stageIndex: 3,
      normalizedStatus: 'Packaged',
      subStage: 'Handcrafted Packaging Complete',
    };
  }

  // 4: Out for Delivery
  if (['Out for Delivery', 'On the Way', 'Dispatched'].includes(s)) {
    return {
      stageIndex: 4,
      normalizedStatus: 'Out for Delivery',
      subStage: 'Delivery Hero En Route',
    };
  }

  // 5: Delivered / Completed / Ready for Pickup
  if (['Delivered', 'Completed', 'Ready for Pickup', 'Fulfilled'].includes(s)) {
    return {
      stageIndex: 5,
      normalizedStatus: 'Delivered',
      subStage: s === 'Ready for Pickup' ? 'Ready for Counter Pickup' : 'Order Delivered Fresh',
    };
  }

  const direct = ORDER_STAGES.indexOf(s);
  if (direct !== -1) {
    return { stageIndex: direct, normalizedStatus: s, subStage: null };
  }

  return { stageIndex: 1, normalizedStatus: 'Accepted', subStage: null };
};

const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('t') || searchParams.get('token') || '';
  const storedToken = orderId ? (localStorage.getItem(`crumb_order_token_${orderId}`) || '') : '';
  const trackingToken = tokenFromUrl || storedToken;
  const navigate = useNavigate();
  const { currency, slug, name: businessName } = useBusiness();
  const { isAuthenticated } = useAuth();

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);

  // Replacement screenshot state
  const [replacementFile, setReplacementFile] = useState(null);
  const [replacementPreview, setReplacementPreview] = useState(null);
  const [isUploadingReplacement, setIsUploadingReplacement] = useState(false);
  const [replacementError, setReplacementError] = useState(null);
  const [replacementSuccess, setReplacementSuccess] = useState(false);

  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setReplacementError('Invalid file format. Please upload a JPG, JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setReplacementError('File size exceeds 8MB limit. Please upload a smaller screenshot.');
      return;
    }

    setReplacementError(null);
    setReplacementFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setReplacementPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadReplacement = async () => {
    if (!replacementPreview) {
      setReplacementError('Please select a payment confirmation screenshot to upload.');
      return;
    }

    setIsUploadingReplacement(true);
    setReplacementError(null);
    try {
      const res = await customerService.uploadReplacementScreenshot(order.id, replacementPreview, trackingToken);
      if (res && res.success) {
        setReplacementSuccess(true);
        setReplacementFile(null);
        setReplacementPreview(null);
        await fetchOrderDetails(true);
      } else {
        throw new Error(res?.message || 'Failed to upload replacement screenshot.');
      }
    } catch (err) {
      setReplacementError(err.response?.data?.message || err.message || 'Error uploading replacement screenshot.');
    } finally {
      setIsUploadingReplacement(false);
    }
  };

  const fetchOrderDetails = useCallback(async (silent = false) => {
    if (!orderId) return;
    if (!silent) setIsRefreshing(true);

    try {
      const params = trackingToken ? { t: trackingToken } : {};
      const res = await customerService.getOrderById(orderId, params);
      if (res && res.success && res.data) {
        setOrder(res.data);
        if (res.data.tracking_token) {
          localStorage.setItem(`crumb_order_token_${res.data.order_no || res.data.id}`, res.data.tracking_token);
          localStorage.setItem(`crumb_order_token_${res.data.id}`, res.data.tracking_token);
        }
        setError(null);
      } else {
        throw new Error(res?.message || 'Order could not be found.');
      }
    } catch (err) {
      const status = err.response?.status;
      const code = err.response?.data?.error?.code || err.code;
      const message =
        status === 404 || code === 'ORDER_NOT_FOUND'
          ? 'Order not found or you do not have permission to access it.'
          : status === 403 || code === 'FORBIDDEN_RESOURCE'
          ? 'Access denied. You may only view orders that belong to your account.'
          : err.response?.data?.message || err.message || 'Unable to load order tracking details.';
      setError({ status, code, message });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [orderId, trackingToken]);

  // Initial fetch
  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // Gentle Polling: Poll every 15 seconds while order is active (not Delivered/Cancelled)
  useEffect(() => {
    if (!order) return;
    const isTerminal = order.order_status === 'Delivered' || order.order_status === 'Completed' || order.order_status === 'Cancelled' || order.order_status === 'Rejected';
    if (isTerminal) return;

    pollTimerRef.current = setInterval(() => {
      fetchOrderDetails(true);
    }, 15000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [order, fetchOrderDetails]);

  const stageInfo = normalizeCustomerStage(order?.order_status);
  const currentStageIndex = stageInfo.stageIndex;
  const isCancelled = order?.order_status === 'Cancelled';
  const isRejected = order?.order_status === 'Rejected' || order?.payment_status === 'Rejected';
  const isPendingVerification = order?.payment_status === 'Pending Verification' && !isRejected;

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '20px' }}>
          <Link
            to={bPath('/orders')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} /> Back to My Orders
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <Loader2 size={40} className="animate-spin" style={{ color: 'var(--color-brand-primary)', margin: '0 auto 16px' }} />
            <h2 className="font-serif" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>Loading Order Details...</h2>
          </div>
        )}

        {/* Error / Inaccessible State */}
        {!isLoading && error && (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <AlertCircle size={44} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
            <h2 className="font-serif" style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              {error.status === 404 ? 'Order Not Found' : 'Access Restricted'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '480px', margin: '0 auto 24px' }}>
              {error.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => fetchOrderDetails()} className="btn btn-secondary btn-pill">
                Retry
              </button>
              <Link to={bPath('/orders')} className="btn btn-primary btn-pill">
                Return to My Orders
              </Link>
            </div>
          </div>
        )}

        {/* Loaded Order View */}
        {!isLoading && !error && order && (
          <>
            {/* Order Header Card */}
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Tracking Status for {businessName || 'Bakery'}
                  </span>
                  <h1 className="font-serif" style={{ fontSize: '28px', color: 'var(--text-primary)' }}>
                    Order #{order.order_no || order.id}
                  </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => fetchOrderDetails()}
                    disabled={isRefreshing}
                    className="btn btn-secondary btn-sm btn-pill"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Refresh status from backend"
                  >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>

                  <span
                    style={{
                      backgroundColor: (isCancelled || isRejected) ? '#FEE2E2' : '#E0F2FE',
                      color: (isCancelled || isRejected) ? '#B91C1C' : '#0369A1',
                      padding: '6px 16px',
                      borderRadius: '9999px',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    {isRejected ? 'Payment Rejected' : (stageInfo.subStage || stageInfo.normalizedStatus || order.order_status)}
                  </span>
                </div>
              </div>

              {/* Payment Verification / Rejection Banner */}
              {isRejected ? (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    color: '#991B1B',
                    border: '1.5px solid #FCA5A5',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                    <AlertCircle size={24} style={{ flexShrink: 0, color: '#DC2626', marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '15px', display: 'block', color: '#B91C1C' }}>
                        Payment Status: Payment Rejected
                      </strong>
                      <span style={{ display: 'block', marginTop: '4px', lineHeight: 1.4, color: '#7F1D1D' }}>
                        <strong>Reason:</strong> {order.rejection_reason || 'Payment screenshot could not be verified in the bank account.'}
                      </span>
                      <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', color: '#991B1B' }}>
                        Upload a clear payment screenshot below to resubmit for verification. Your order will be placed back in the verification queue.
                      </span>
                    </div>
                  </div>

                  {/* Customer Replacement Screenshot Upload Box */}
                  <div
                    style={{
                      backgroundColor: '#FFF',
                      borderRadius: '8px',
                      border: '1px dashed #F87171',
                      padding: '16px',
                    }}
                  >
                    <label style={{ display: 'block', fontWeight: 600, color: '#1F2937', marginBottom: '8px', fontSize: '13px' }}>
                      Upload Replacement Payment Confirmation Screenshot (JPG, JPEG, PNG, WebP ≤ 8MB)
                    </label>

                    {replacementError && (
                      <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={14} /> {replacementError}
                      </div>
                    )}

                    {replacementSuccess && (
                      <div style={{ color: '#059669', fontSize: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={14} /> Replacement screenshot uploaded successfully! Status updated to Pending Verification.
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        onChange={handleFileSelect}
                        style={{ fontSize: '13px' }}
                      />

                      {replacementPreview && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={replacementPreview}
                            alt="Screenshot Preview"
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E5E7EB' }}
                          />
                          <button
                            type="button"
                            onClick={handleUploadReplacement}
                            disabled={isUploadingReplacement}
                            className="btn btn-primary btn-sm btn-pill"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            {isUploadingReplacement ? (
                              <>
                                <Loader2 size={14} className="animate-spin" /> Submitting...
                              </>
                            ) : (
                              <>
                                <Upload size={14} /> Submit Replacement
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: isPendingVerification ? '#FEF3C7' : '#D1FAE5',
                    color: isPendingVerification ? '#92400E' : '#065F46',
                    border: `1px solid ${isPendingVerification ? '#FCD34D' : '#A7F3D0'}`,
                    borderRadius: '12px',
                    padding: '14px 18px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '13px',
                  }}
                >
                  <ShieldCheck size={20} style={{ flexShrink: 0, color: isPendingVerification ? '#B45309' : '#059669' }} />
                  <div style={{ flex: 1 }}>
                    <strong>Payment Status: {order.payment_status}</strong>
                    {isPendingVerification ? (
                      <span style={{ display: 'block', marginTop: '2px' }}>
                        Your UPI payment screenshot is awaiting bakery verification against the business account.
                      </span>
                    ) : (
                      <span style={{ display: 'block', marginTop: '2px' }}>
                        Payment has been confirmed and verified by the bakery.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ETA / Delivery Date & Time Slot Banner */}
              <div
                style={{
                  backgroundColor: '#FDF7F2',
                  border: '1px solid #EAD8C7',
                  padding: '20px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-brand-primary)',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {order.order_type === 'dine_in' ? <Utensils size={24} /> : <Calendar size={24} />}
                </div>

                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {order.order_type === 'dine_in'
                      ? `Table Service: ${order.table_tag || 'Indoor Table'}`
                      : order.order_type === 'pickup'
                      ? 'Counter Pickup'
                      : `Scheduled Delivery: ${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Standard Dispatch'}`}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {order.order_type === 'dine_in'
                      ? 'Items will be brought fresh from the oven to your table.'
                      : order.order_type === 'pickup'
                      ? `Collect at ${businessName || 'the bakery'} front counter.`
                      : `Delivery Time Slot: ${order.delivery_time_slot || 'Standard Window'}`}
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Stage Vertical Journey Stepper matching Figma */}
            {!isCancelled && (
              <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>
                  Order Journey
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                  {ORDER_STAGES.map((stage, idx) => {
                    const isDeliveredState = order.order_status === 'Delivered' || stageInfo.normalizedStatus === 'Delivered';
                    const isCompleted = idx < currentStageIndex || isDeliveredState;
                    const isCurrent = idx === currentStageIndex && !isDeliveredState;

                    const displayStageName =
                      stage === 'Out for Delivery' && order.order_type === 'pickup'
                        ? 'Ready for Pickup'
                        : stage === 'Out for Delivery' && order.order_type === 'dine_in'
                        ? 'Ready at Table'
                        : stage;

                    return (
                      <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: isCompleted ? '#2E7D32' : isCurrent ? 'var(--color-brand-primary)' : 'var(--bg-surface-soft)',
                            color: isCompleted || isCurrent ? '#FFF' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '13px',
                            border: `1px solid ${isCompleted ? '#2E7D32' : isCurrent ? 'var(--color-brand-primary)' : 'var(--border-light)'}`,
                            flexShrink: 0,
                          }}
                        >
                          {isCompleted ? <Check size={18} /> : idx + 1}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '15px',
                              fontWeight: isCurrent ? 700 : isCompleted ? 600 : 500,
                              color: isCurrent ? 'var(--color-brand-primary)' : isCompleted ? 'var(--text-primary)' : 'var(--text-muted)',
                            }}
                          >
                            {displayStageName}
                          </div>
                          {(isCurrent || isCompleted) && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {isCurrent && stageInfo.subStage ? stageInfo.subStage : (STAGE_DESCRIPTIONS[stage] || 'Step processed by bakery')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivered Celebration & Review Prompt */}
            {(order.order_status === 'Delivered' || stageInfo.normalizedStatus === 'Delivered') && (
              <div
                className="card"
                style={{
                  padding: '24px',
                  marginBottom: '24px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#166534', margin: 0 }}>
                      Order Delivered Fresh!
                    </h3>
                    <p style={{ fontSize: '13px', color: '#15803D', margin: '2px 0 0' }}>
                      We hope you enjoy every bite. How was your experience today?
                    </p>
                  </div>
                </div>
                <Link to={bPath(`/feedback/${order.id}`)} className="btn btn-primary btn-sm btn-pill">
                  Rate Order & Review
                </Link>
              </div>
            )}

            {/* Cancelled Banner if applicable */}
            {isCancelled && (
              <div
                className="card"
                style={{ padding: '24px', marginBottom: '24px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertCircle size={24} color="#DC2626" />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#991B1B' }}>Order Cancelled</h3>
                    <p style={{ fontSize: '13px', color: '#B91C1C' }}>
                      This order was cancelled. Any applicable payments will be reconciled by our team.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Hero / Contact Card matching Figma */}
            {order.order_type === 'delivery' && (
              <div
                className="card"
                style={{
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-brand-primary)',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '16px',
                    }}
                  >
                    RK
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Your Delivery Hero</div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {order.delivery_hero_name || 'Ramesh Kumar'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <a href={`tel:${order.delivery_hero_phone || '+919820112345'}`} className="btn btn-secondary btn-sm btn-pill">
                    <Phone size={14} /> Call Ramesh
                  </a>
                  <Link to={bPath(`/feedback/${order.id}`)} className="btn btn-secondary btn-sm btn-pill">
                    <HelpCircle size={14} /> Need Help?
                  </Link>
                </div>
              </div>
            )}

            {/* Self Delivery / Counter Pickup Card */}
            {order.order_type === 'pickup' && (
              <div
                className="card"
                style={{
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '24px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: '#DCFCE7',
                      color: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '22px',
                    }}
                  >
                    🏪
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Fulfillment: Self Delivery / Counter Pickup</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#14532D' }}>
                      Bakery Counter Collection • Delivery fee waived (₹0)
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Link to={bPath(`/feedback/${order.id}`)} className="btn btn-secondary btn-sm btn-pill">
                    <HelpCircle size={14} /> Need Help?
                  </Link>
                </div>
              </div>
            )}

            {/* Historical Order Items & Summary Card */}
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                Order Summary & Historical Pricing
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {item.product_name || item.name || 'Artisanal Baked Item'} {item.variant ? `(${item.variant})` : ''} × {item.quantity}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrency(item.subtotal || item.unit_price * item.quantity, currency)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No item details recorded</div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '16px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Delivery Fee</span>
                  <span style={{ fontWeight: 600, color: order.order_type === 'pickup' ? '#16A34A' : 'var(--text-primary)' }}>
                    {order.order_type === 'pickup'
                      ? 'FREE (Self Delivery)'
                      : Number(order.delivery_fee) === 0
                      ? 'FREE'
                      : formatCurrency(order.delivery_fee, currency)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Taxes (5% GST)</span>
                  <span>{formatCurrency(order.tax_amount, currency)}</span>
                </div>
                {Number(order.discount_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2E7D32', fontWeight: 600 }}>
                    <span>Discount</span>
                    <span>-{formatCurrency(order.discount_amount, currency)}</span>
                  </div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '16px 0' }} />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                <span>Total Amount Paid</span>
                <span style={{ color: 'var(--color-brand-primary)' }}>
                  {formatCurrency(order.total_amount, currency)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderTrackingPage;
