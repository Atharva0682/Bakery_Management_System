import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Check,
  X,
  XCircle,
  RefreshCw,
  QrCode,
  DollarSign,
  User,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { useBusiness } from '../../context/BusinessContext';

const REJECTION_REASONS = [
  'Screenshot unclear, unreadable, or cropped',
  'Amount on screenshot does not match order total',
  'Duplicate or previously used screenshot',
  'Transaction ID / UTR not found on bank statement',
  'Payment reversed or failed at bank gateway',
  'Other / Unverified payment'
];

const OwnerPaymentApprovalsPage = () => {
  const { currency } = useBusiness();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [notification, setNotification] = useState('');

  // Rejection modal state
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [selectedReason, setSelectedReason] = useState(REJECTION_REASONS[0]);
  const [rejectionNote, setRejectionNote] = useState('');

  // Screenshot viewer modal state
  const [previewScreenshot, setPreviewScreenshot] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/orders/business/all');
      const all = res.data?.data || res.data || [];
      setOrders(all);
    } catch (err) {
      console.error('Failed to load orders for payment approval:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // 20s auto-refresh, paused when tab is hidden
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchOrders();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (orderId) => {
    setActionLoading(orderId);
    try {
      await api.patch(`/api/orders/${orderId}/approve-payment`);
      setNotification(`Payment for Order #${orderId} verified & approved! Sent to Baker.`);
      setTimeout(() => setNotification(''), 4000);
      await fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to approve payment.');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (order) => {
    setRejectingOrder(order);
    setSelectedReason(REJECTION_REASONS[0]);
    setRejectionNote('');
  };

  const closeRejectModal = () => {
    setRejectingOrder(null);
    setSelectedReason(REJECTION_REASONS[0]);
    setRejectionNote('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingOrder) return;
    const finalReason = rejectionNote.trim()
      ? `${selectedReason} — ${rejectionNote.trim()}`
      : selectedReason;

    const orderId = rejectingOrder.id;
    setActionLoading(orderId);
    try {
      await api.patch(`/api/orders/${orderId}/reject-payment`, { reason: finalReason });
      setNotification(`Payment for Order #${orderId} rejected.`);
      setTimeout(() => setNotification(''), 4000);
      closeRejectModal();
      await fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to reject payment.');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingOrders = orders.filter(o => o.payment_status === 'Pending Verification' && o.order_status !== 'Rejected');
  const approvedOrders = orders.filter(o => (o.payment_status === 'Paid' || o.payment_status === 'Verified') && o.order_status !== 'Rejected');
  const rejectedOrders = orders.filter(o => o.payment_status === 'Rejected' || o.order_status === 'Rejected');

  const displayedOrders = (
    activeTab === 'PENDING' ? pendingOrders :
    activeTab === 'APPROVED' ? approvedOrders :
    activeTab === 'REJECTED' ? rejectedOrders :
    orders
  ).filter(o => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      (o.order_no && o.order_no.toLowerCase().includes(q)) ||
      (o.guest_name && o.guest_name.toLowerCase().includes(q)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.transaction_id && o.transaction_id.toLowerCase().includes(q)) ||
      (o.payment?.qr_reference_code && o.payment.qr_reference_code.toLowerCase().includes(q)) ||
      String(o.id).includes(q)
    );
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Alert */}
      {notification && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '12px 18px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #E7E5E4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D97706'
          }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              Payment Verification & Approvals
            </h1>
            <p style={{ fontSize: '13px', color: '#78716C', margin: '4px 0 0' }}>
              Verify customer UPI payment screenshots before orders are dispatched to the Baker's kitchen station.
            </p>
          </div>
        </div>

        <button
          onClick={fetchOrders}
          disabled={loading}
          style={{
            padding: '9px 16px',
            borderRadius: '8px',
            border: '1px solid #D6D3D1',
            backgroundColor: '#FAFAF9',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Payments</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        padding: '16px',
        border: '1px solid #E7E5E4',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: activeTab === 'PENDING' ? '1.5px solid #C25E00' : '1px solid #E7E5E4',
              backgroundColor: activeTab === 'PENDING' ? '#FFFBEB' : '#FAFAF9',
              color: activeTab === 'PENDING' ? '#B45309' : '#57534E',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Pending</span>
            <span style={{
              backgroundColor: '#B45309',
              color: '#FFFFFF',
              borderRadius: '12px',
              padding: '1px 8px',
              fontSize: '11px'
            }}>
              {pendingOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPROVED')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: activeTab === 'APPROVED' ? '1.5px solid #059669' : '1px solid #E7E5E4',
              backgroundColor: activeTab === 'APPROVED' ? '#ECFDF5' : '#FAFAF9',
              color: activeTab === 'APPROVED' ? '#065F46' : '#57534E',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Approved</span>
            <span style={{
              backgroundColor: '#059669',
              color: '#FFFFFF',
              borderRadius: '12px',
              padding: '1px 8px',
              fontSize: '11px'
            }}>
              {approvedOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REJECTED')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: activeTab === 'REJECTED' ? '1.5px solid #DC2626' : '1px solid #E7E5E4',
              backgroundColor: activeTab === 'REJECTED' ? '#FEF2F2' : '#FAFAF9',
              color: activeTab === 'REJECTED' ? '#B91C1C' : '#57534E',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Rejected</span>
            <span style={{
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              borderRadius: '12px',
              padding: '1px 8px',
              fontSize: '11px'
            }}>
              {rejectedOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            style={{
              padding: '7px 16px',
              borderRadius: '8px',
              border: activeTab === 'ALL' ? '1.5px solid #5A3825' : '1px solid #E7E5E4',
              backgroundColor: activeTab === 'ALL' ? '#FAF6F0' : '#FAFAF9',
              color: activeTab === 'ALL' ? '#5A3825' : '#57534E',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            All ({orders.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} color="#A8A29E" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input
            type="text"
            placeholder="Search Order # or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #D6D3D1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Orders List */}
      {loading && orders.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#78716C', border: '1px solid #E7E5E4' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>Loading orders and incoming payments...</p>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#78716C', border: '1px solid #E7E5E4' }}>
          <ShieldCheck size={36} color="#A8A29E" style={{ margin: '0 auto 12px' }} />
          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#1C1917' }}>
            {activeTab === 'PENDING' ? 'No orders currently pending verification.' :
             activeTab === 'APPROVED' ? 'No approved orders in this view.' :
             activeTab === 'REJECTED' ? 'No rejected orders recorded.' :
             'No orders matching the criteria.'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
            {activeTab === 'PENDING' ? 'New customer orders with UPI transfers will appear here automatically.' : ''}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayedOrders.map((order) => {
            const isPending = order.payment_status === 'Pending Verification' && order.order_status !== 'Rejected';
            const isApproved = (order.payment_status === 'Paid' || order.payment_status === 'Verified') && order.order_status !== 'Rejected';
            const isRejected = order.payment_status === 'Rejected' || order.order_status === 'Rejected';
            const utrCode = order.transaction_id || order.payment?.qr_reference_code || 'Not Provided';

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  border: isRejected ? '1.5px solid #FCA5A5' : isPending ? '1.5px solid #FCD34D' : '1px solid #E7E5E4',
                  boxShadow: isPending ? '0 4px 12px rgba(245, 158, 11, 0.08)' : '0 1px 4px rgba(0,0,0,0.02)',
                  padding: '20px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                {/* Left: Order & Customer Info */}
                <div style={{ minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#1C1917' }}>
                      #{order.order_no || order.id}
                    </span>
                    <span style={{
                      backgroundColor: isRejected ? '#FEE2E2' : isPending ? '#FEF3C7' : '#DCFCE7',
                      color: isRejected ? '#B91C1C' : isPending ? '#92400E' : '#15803D',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {isRejected ? 'Rejected' : order.payment_status}
                    </span>
                    <span style={{
                      backgroundColor: '#F5F5F4',
                      color: '#44403C',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textTransform: 'capitalize'
                    }}>
                      {order.order_type}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#44403C', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <User size={14} color="#78716C" />
                    <strong>{order.guest_name || order.customer_name || 'Customer / Guest'}</strong>
                  </div>

                  {isRejected && (
                    <div style={{
                      fontSize: '12px',
                      color: '#B91C1C',
                      backgroundColor: '#FEF2F2',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      marginTop: '6px',
                      lineHeight: 1.4
                    }}>
                      <strong>Rejection Reason:</strong> {order.rejection_reason || 'Payment screenshot not verified'}
                    </div>
                  )}

                  {order.special_instructions && !isRejected && (
                    <div style={{ fontSize: '12px', color: '#78716C', maxWidth: '380px', lineHeight: 1.4 }}>
                      {order.special_instructions}
                    </div>
                  )}
                </div>

                {/* Middle: Payment Screenshot & Verification */}
                <div style={{
                  backgroundColor: isRejected ? '#FFF5F5' : isPending ? '#FFFBEB' : '#F9F8F6',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  border: isRejected ? '1px dashed #F87171' : isPending ? '1px dashed #F59E0B' : '1px solid #E7E5E4',
                  textAlign: 'left',
                  minWidth: '220px'
                }}>
                  <div style={{ fontSize: '11px', color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Payment Proof (Screenshot):
                  </div>
                  {order.screenshot_data || order.payment?.screenshot_data || order.screenshot_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={order.screenshot_data || order.payment?.screenshot_data || order.screenshot_url}
                        alt="Screenshot thumbnail"
                        onClick={() => setPreviewScreenshot({
                          src: order.screenshot_data || order.payment?.screenshot_data || order.screenshot_url,
                          orderNo: order.order_no || order.id,
                          uploadedAt: order.screenshot_uploaded_at || order.payment?.screenshot_uploaded_at || order.created_at,
                          amount: order.total_amount
                        })}
                        style={{
                          width: '48px',
                          height: '48px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          cursor: 'pointer'
                        }}
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => setPreviewScreenshot({
                            src: order.screenshot_data || order.payment?.screenshot_data || order.screenshot_url,
                            orderNo: order.order_no || order.id,
                            uploadedAt: order.screenshot_uploaded_at || order.payment?.screenshot_uploaded_at || order.created_at,
                            amount: order.total_amount
                          })}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#1F2937',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={13} /> View Screenshot
                        </button>
                        <span style={{ fontSize: '10px', color: '#6B7280', display: 'block', marginTop: '2px' }}>
                          Auto-deletes after 30 days
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#6B7280', fontStyle: 'italic' }}>
                      No screenshot uploaded ({order.payment_method || 'CASH_ON_DELIVERY'})
                    </div>
                  )}
                  {utrCode && utrCode !== 'Not Provided' && (
                    <div style={{ fontSize: '11px', color: '#78716C', marginTop: '6px' }}>
                      Ref: <span style={{ fontFamily: 'monospace' }}>{utrCode}</span>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div style={{ textAlign: 'right', minWidth: '110px' }}>
                  <div style={{ fontSize: '11px', color: '#78716C' }}>Order Total</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1C1917' }}>
                    {formatCurrency(order.total_amount, currency)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#78716C' }}>
                    {order.items?.length || 1} items
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(order.id)}
                        disabled={actionLoading === order.id}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: actionLoading === order.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
                        }}
                      >
                        <Check size={16} />
                        <span>{actionLoading === order.id ? 'Approving...' : 'Accept & Send to Baker'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openRejectModal(order)}
                        disabled={actionLoading === order.id}
                        style={{
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #FECACA',
                          backgroundColor: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: actionLoading === order.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </>
                  ) : isApproved ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '13px', fontWeight: 700 }}>
                      <CheckCircle2 size={16} />
                      <span>Verified for Kitchen</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '13px', fontWeight: 700 }}>
                      <XCircle size={16} />
                      <span>Payment Rejected</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Styled Rejection Modal */}
      {rejectingOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #E7E5E4'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#DC2626'
              }}>
                <XCircle size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1C1917' }}>
                  Reject Payment for Order #{rejectingOrder.order_no || rejectingOrder.id}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#78716C' }}>
                  Amount: {formatCurrency(rejectingOrder.total_amount, currency)} • Ref: {rejectingOrder.transaction_id || rejectingOrder.payment?.qr_reference_code || 'Screenshot Uploaded'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Select Reason <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D6D3D1',
                    fontSize: '13px',
                    backgroundColor: '#FFFFFF',
                    color: '#1C1917',
                    outline: 'none'
                  }}
                >
                  {REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Additional Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Checked bank ledger at 11:30 AM, no credit matching ₹418."
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #D6D3D1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{
                fontSize: '11px',
                color: '#991B1B',
                backgroundColor: '#FEF2F2',
                padding: '8px 12px',
                borderRadius: '6px',
                lineHeight: 1.4
              }}>
                <strong>Notice:</strong> Rejecting will mark this order as "Rejected" permanently. It will not be sent to the baker and adds ₹0 to revenue.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={closeRejectModal}
                disabled={actionLoading}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #D6D3D1',
                  backgroundColor: '#FFFFFF',
                  color: '#44403C',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {previewScreenshot && (
        <div
          onClick={() => setPreviewScreenshot(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1C1917' }}>
                  Payment Screenshot — Order #{previewScreenshot.orderNo}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
                  Order Total: {formatCurrency(previewScreenshot.amount, currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewScreenshot(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: '#6B7280',
                  padding: '4px 8px'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
              <img
                src={previewScreenshot.src}
                alt="Payment screenshot full"
                style={{
                  maxWidth: '100%',
                  maxHeight: '55vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>

            <div style={{
              padding: '10px 14px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#1E40AF',
              lineHeight: 1.4,
              marginBottom: '16px'
            }}>
              🔒 <strong>30-Day Auto-Deletion Policy:</strong> This payment screenshot is kept only for verification and will be automatically & permanently purged after 30 days.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPreviewScreenshot(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#4B5563',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerPaymentApprovalsPage;
