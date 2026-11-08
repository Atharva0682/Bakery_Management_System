import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RotateCcw, Eye, HelpCircle, Loader2, AlertCircle, ShoppingBag, Clock, CheckCircle2, MapPin } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import customerService from '../services/customerService';

const MyOrdersPage = () => {
  const navigate = useNavigate();
  const { currency, slug, name: businessName } = useBusiness();
  const { user, isAuthenticated } = useAuth();

  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await customerService.getCustomerOrders();
      if (res && res.success && Array.isArray(res.data)) {
        setOrders(res.data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load your orders.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    const isCompleted = order.order_status === 'Delivered' || order.order_status === 'Cancelled' || order.order_status === 'Completed';
    if (activeTab === 'Active') return !isCompleted;
    if (activeTab === 'Past') return isCompleted;
    return true;
  });

  // Dynamically extract real unique items previously ordered by this customer
  const pastOrderedItems = React.useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const itemMap = new Map();
    orders.forEach((order) => {
      const items = order.items || [];
      items.forEach((item) => {
        const itemName = item.product_name || item.name;
        if (itemName && !itemMap.has(itemName)) {
          itemMap.set(itemName, {
            name: itemName,
            price: item.unit_price || item.price || 0,
            rating: item.rating || 4.9,
          });
        }
      });
    });
    return Array.from(itemMap.values()).slice(0, 3);
  }, [orders]);

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Order Placed':
        return { bg: '#E0F2FE', text: '#0369A1' };
      case 'Accepted':
      case 'In Production':
      case 'Baking':
      case 'Product Completed':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'Quality Check':
      case 'Packaging':
      case 'Packaged':
      case 'Packed':
      case 'Product Packed':
      case 'Product Completed & Packed':
        return { bg: '#DCFCE7', text: '#15803D' };
      case 'Out for Delivery':
        return { bg: '#CCFBF1', text: '#0F766E' };
      case 'Delivered':
        return { bg: '#DCFCE7', text: '#15803D' };
      case 'Cancelled':
        return { bg: '#FEE2E2', text: '#B91C1C' };
      default:
        return { bg: '#F3F4F6', text: '#374151' };
    }
  };

  const getPaymentBadgeStyle = (paymentStatus) => {
    switch (paymentStatus) {
      case 'Paid':
      case 'Verified':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'Pending Verification':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'Unpaid':
        return { bg: '#F3F4F6', text: '#4B5563' };
      default:
        return { bg: '#F3F4F6', text: '#4B5563' };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Order Again Shelf - Only visible if customer actually has past ordered items */}
        {pastOrderedItems.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h2 className="font-serif" style={{ fontSize: '24px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              Order Again
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {pastOrderedItems.map((item) => (
                <div
                  key={item.name}
                  className="card"
                  style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <strong style={{ color: 'var(--color-brand-primary)' }}>{formatCurrency(item.price, currency)}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: 'var(--color-star)', fontWeight: 600 }}>★ {item.rating}</span>
                    </div>
                  </div>
                  <Link to={bPath('/menu')} className="btn btn-primary btn-sm btn-pill" style={{ padding: '6px 16px', fontSize: '13px' }}>
                    Reorder
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Orders History Section */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h1 className="font-serif" style={{ fontSize: '28px', color: 'var(--text-primary)' }}>
                My Orders History
              </h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Orders for <strong style={{ color: 'var(--text-primary)' }}>{user?.name || 'Customer'}</strong> at{' '}
                {businessName || 'Bakery'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {['All', 'Active', 'Past'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="btn btn-pill btn-sm"
                  style={{
                    backgroundColor: activeTab === tab ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                    color: activeTab === tab ? '#FFF' : 'var(--text-secondary)',
                    border: `1px solid ${activeTab === tab ? 'var(--color-brand-primary)' : 'var(--border-light)'}`,
                  }}
                >
                  {tab === 'All' ? 'All Orders' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              style={{
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                border: '1px solid #F87171',
                padding: '16px 20px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
              <button onClick={fetchOrders} className="btn btn-secondary btn-sm btn-pill">
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-brand-primary)', margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Loading your orders...</p>
            </div>
          )}

          {/* Unauthenticated State */}
          {!isLoading && !isAuthenticated && (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '540px', margin: '0 auto' }}>
              <ShoppingBag size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
              <h2 className="font-serif" style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--text-primary)' }}>
                Sign In to View Orders
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                Please sign in to access your personal order history and live tracking.
              </p>
              <button onClick={() => navigate(bPath('/'))} className="btn btn-primary btn-pill">
                Go to Sign In
              </button>
            </div>
          )}

          {/* Empty Orders State */}
          {!isLoading && isAuthenticated && !error && filteredOrders.length === 0 && (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '540px', margin: '0 auto' }}>
              <ShoppingBag size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
              <h2 className="font-serif" style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--text-primary)' }}>
                {activeTab === 'All' ? 'No Orders Placed Yet' : `No ${activeTab} Orders Found`}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                {activeTab === 'All'
                  ? 'Explore our artisanal breads, pastries, and treats to place your very first order!'
                  : `You currently have no ${activeTab.toLowerCase()} orders.`}
              </p>
              <Link to={bPath('/menu')} className="btn btn-primary btn-pill">
                Browse Artisanal Menu
              </Link>
            </div>
          )}

          {/* Orders Cards List matching Figma */}
          {!isLoading && filteredOrders.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {filteredOrders.map((order) => {
                const statusStyle = getStatusBadgeStyle(order.order_status);
                const paymentStyle = getPaymentBadgeStyle(order.payment_status);

                return (
                  <div key={order.id} className="card" style={{ padding: '24px' }}>
                    {/* Header: Order Number, Date, Status, Total */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginRight: '12px' }}>
                          Order #{order.order_no || order.id}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatDate(order.created_at)}</span>

                        {order.delivery_date && (
                          <span
                            style={{
                              marginLeft: '10px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#15803D',
                              backgroundColor: '#DCFCE7',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #BBF7D0',
                            }}
                          >
                            {order.order_type === 'pickup' ? 'Counter Pickup' : 'Delivery'}: {new Date(order.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ({order.delivery_time_slot || 'Standard'})
                          </span>
                        )}

                        {order.table_tag && (
                          <span
                            style={{
                              marginLeft: '10px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--color-brand-primary)',
                              backgroundColor: '#FDF7F2',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #EAD8C7',
                            }}
                          >
                            Dine-in: {order.table_tag}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.text,
                          }}
                        >
                          {['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed'].includes(order.order_status)
                            ? 'Product Completed & Packed'
                            : order.order_status}
                        </span>

                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: paymentStyle.bg,
                            color: paymentStyle.text,
                          }}
                        >
                          Payment: {order.payment_status}
                        </span>

                        <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginLeft: '6px' }}>
                          {formatCurrency(order.total_amount || order.total, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Historical Items Breakdown */}
                    <div
                      style={{
                        borderTop: '1px solid var(--border-light)',
                        paddingTop: '14px',
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <div
                            key={idx}
                            style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)' }}
                          >
                            <span>
                              {item.product_name || item.name || 'Artisanal Baked Item'} {item.variant ? `(${item.variant})` : ''}
                            </span>
                            <span style={{ fontWeight: 500 }}>
                              Qty: {item.quantity} × {formatCurrency(item.unit_price, currency)} ={' '}
                              <strong style={{ color: 'var(--text-primary)' }}>
                                {formatCurrency(item.subtotal || item.unit_price * item.quantity, currency)}
                              </strong>
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          Fulfillment: {order.order_type} • Items queued
                        </div>
                      )}
                    </div>

                    {/* Actions matching Figma: Repeat Order, View Details, Need Help with Order? */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        borderTop: '1px solid var(--border-light)',
                        paddingTop: '16px',
                        alignItems: 'center',
                      }}
                    >
                      <Link to={bPath('/menu')} className="btn btn-primary btn-sm btn-pill">
                        <RotateCcw size={14} /> Repeat Order
                      </Link>
                      <Link
                        to={bPath(`/order-tracking/${order.order_no || order.id}`)}
                        className="btn btn-secondary btn-sm btn-pill"
                      >
                        <Eye size={14} /> View Details
                      </Link>
                      <Link
                        to={bPath(`/feedback/${order.id}`)}
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-muted)',
                          marginLeft: 'auto',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <HelpCircle size={14} /> Need Help with Order?
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyOrdersPage;
