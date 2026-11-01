import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowRight, Tag, MapPin, Truck, Store, CheckCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useBusiness } from '../context/BusinessContext';
import { useQr } from '../context/QrContext';
import { formatCurrency } from '../utils/formatters';

const CartPage = () => {
  const {
    items,
    updateQuantity,
    removeItem,
    totalItemCount,
    subtotal,
    deliveryMethod,
    setDeliveryMethod,
    deliveryFee,
    standardDeliveryFee,
    deliveryFeeSaved,
    taxFee,
    discountAmount,
    grandTotal,
  } = useCart();

  const { slug, currency, name } = useBusiness();
  const { locationTag, hasTableContext } = useQr();

  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  const [couponCode, setCouponCode] = React.useState('CRUMB25');
  const [couponApplied, setCouponApplied] = React.useState(true);
  const [couponMsg, setCouponMsg] = React.useState('Coupon CRUMB25 applied! 25% savings active.');

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    if (couponCode.trim().toUpperCase() === 'CRUMB25') {
      setCouponApplied(true);
      setCouponMsg('Coupon CRUMB25 applied! 25% savings active.');
    } else {
      setCouponApplied(false);
      setCouponMsg('Invalid coupon code. Try CRUMB25 for 25% off.');
    }
  };

  const calculatedDiscount = couponApplied ? Math.min(337.5, subtotal * 0.25) : discountAmount;
  const effectiveGrandTotal = Math.max(0, subtotal + deliveryFee + taxFee - calculatedDiscount);

  // Quick add sample items matching Figma
  const quickAddUsual = [
    { id: 'usual-1', name: 'Nankhatai Pack', price: 150, image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=200' },
    { id: 'usual-2', name: 'Khari Biscuit Pack', price: 120, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200' },
  ];

  const quickAddFrequently = [
    { id: 'freq-1', name: 'Cold Brew Milk Coffee', price: 110, image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=200' },
    { id: 'freq-2', name: 'Mawa Cake Slice', price: 120, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=200' },
  ];

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Table / Location Context Banner if entered via QR */}
        {hasTableContext && locationTag && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(216, 109, 139, 0.08)',
              color: 'var(--color-brand-primary)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md, 12px)',
              marginBottom: '20px',
              border: '1px solid rgba(216, 109, 139, 0.2)',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <MapPin size={16} />
            <span>Ordering station: <strong>{locationTag}</strong> ({name || 'Bakery'})</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 className="font-serif" style={{ fontSize: '32px', color: 'var(--text-primary)', margin: 0 }}>
            Your Shopping Cart ({totalItemCount} {totalItemCount === 1 ? 'Item' : 'Items'})
          </h1>
          {items.length > 0 && (
            <span style={{ fontSize: '14px', color: 'var(--color-brand-primary)', fontWeight: 600, backgroundColor: 'var(--color-brand-primary-light, #FDF2F4)', padding: '4px 14px', borderRadius: '9999px' }}>
              Freshness Guaranteed in 30-45 Mins
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🛒</span>
            <h2 className="font-serif" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Your cart is empty
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Explore our freshly baked sourdoughs, croissants, and cakes to add them here.
            </p>
            <Link to={bPath('/menu')} className="btn btn-primary btn-pill">
              Browse Artisanal Menu
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.4fr) minmax(300px, 1fr)', gap: '36px', alignItems: 'flex-start' }}>
            {/* Left: Cart Items List & Quick Add Shelves */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Items Card List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {items.map((item) => (
                  <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: '16px' }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '12px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {item.name}
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        {item.variant} {item.isEggless && '• 100% Eggless'}
                      </p>
                      {item.note && (
                        <p style={{ fontSize: '12px', color: 'var(--color-brand-primary)', fontStyle: 'italic', marginBottom: '4px' }}>
                          Note: "{item.note}"
                        </p>
                      )}
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(item.price, currency)}
                      </span>
                    </div>

                    {/* Quantity Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-surface-soft)', padding: '6px 12px', borderRadius: '9999px', border: '1px solid var(--border-light)' }}>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-primary)' }}
                        title="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '16px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-primary)' }}
                        title="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 700, color: 'var(--color-brand-primary)', fontSize: '16px' }}>
                      {formatCurrency(item.price * item.quantity, currency)}
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Your Usual Order (Quick Add) shelf from Figma */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Your Usual Order (Quick Add)
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 600 }}>
                      Morning Pair • Save 10%
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {quickAddUsual.map((q) => (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '12px' }}>
                      <img src={q.image} alt={q.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-brand-primary)' }}>{formatCurrency(q.price, currency)}</div>
                      </div>
                      <button
                        onClick={() => addItem({ id: q.id, name: q.name, base_price: q.price, image_url: q.image }, { name: 'Pack', selling_price: q.price }, 1)}
                        className="btn btn-primary btn-sm btn-pill"
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frequently Bought Together shelf from Figma */}
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                  Frequently Bought Together
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {quickAddFrequently.map((q) => (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '12px' }}>
                      <img src={q.image} alt={q.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-brand-primary)' }}>{formatCurrency(q.price, currency)}</div>
                      </div>
                      <button
                        onClick={() => addItem({ id: q.id, name: q.name, base_price: q.price, image_url: q.image }, { name: 'Standard', selling_price: q.price }, 1)}
                        className="btn btn-primary btn-sm btn-pill"
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Coupon & Bill Summary matching Figma */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '90px' }}>
              {/* Coupon Box matching Figma */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Tag size={18} color="var(--color-brand-primary)" />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Have a Coupon/Promo Code?
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 600, marginBottom: '12px' }}>
                  Save ₹337.50 with code CRUMB25
                </div>
                <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter Coupon Code"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '9999px',
                      border: '1px solid var(--border-medium)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm btn-pill" style={{ padding: '8px 18px', fontWeight: 600 }}>
                    Apply
                  </button>
                </form>
                {couponMsg && (
                  <p style={{ fontSize: '12px', color: couponApplied ? 'var(--color-success)' : 'var(--color-error)', marginTop: '8px', margin: '8px 0 0' }}>
                    {couponMsg}
                  </p>
                )}
              </div>

              {/* Bill Summary Card matching Figma */}
              <div className="card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
                  Bill Summary
                </h2>

                {/* Fulfillment Method Selector */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Choose Fulfillment Method:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod && setDeliveryMethod('delivery')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: `1.5px solid ${deliveryMethod === 'delivery' ? 'var(--color-brand-primary)' : 'var(--border-medium)'}`,
                        backgroundColor: deliveryMethod === 'delivery' ? 'var(--color-brand-primary-light, #FDF2F4)' : 'var(--bg-surface)',
                        color: deliveryMethod === 'delivery' ? 'var(--color-brand-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={15} /> <span>Home Delivery</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {deliveryFee === 0 ? 'Free delivery' : `+${formatCurrency(deliveryFee, currency)}`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryMethod && setDeliveryMethod('pickup')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: `1.5px solid ${deliveryMethod === 'pickup' ? '#16A34A' : 'var(--border-medium)'}`,
                        backgroundColor: deliveryMethod === 'pickup' ? '#F0FDF4' : 'var(--bg-surface)',
                        color: deliveryMethod === 'pickup' ? '#15803D' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Store size={15} /> <span>Self Delivery / Pickup</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 700 }}>
                        No delivery charge
                      </span>
                    </button>
                  </div>

                  {deliveryMethod === 'pickup' && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        backgroundColor: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#15803D',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <CheckCircle size={14} style={{ flexShrink: 0 }} />
                      <span>Self Delivery chosen: delivery charges subtracted from your total!</span>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Item Subtotal</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Delivery Partner Fee</span>
                    <span style={{ fontWeight: 600, color: deliveryMethod === 'pickup' ? '#15803D' : 'var(--text-primary)' }}>
                      {deliveryMethod === 'pickup'
                        ? 'FREE (Self Delivery)'
                        : deliveryFee === 0
                        ? 'FREE'
                        : formatCurrency(deliveryFee, currency)}
                    </span>
                  </div>
                  {deliveryFeeSaved > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803D', fontWeight: 600, fontSize: '13px' }}>
                      <span>Self Delivery Waiver</span>
                      <span>-{formatCurrency(deliveryFeeSaved, currency)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Taxes & GST (5%)</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(taxFee, currency)}</span>
                  </div>
                  {calculatedDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)', fontWeight: 600 }}>
                      <span>Coupon Savings (CRUMB25)</span>
                      <span>-{formatCurrency(calculatedDiscount, currency)}</span>
                    </div>
                  )}
                  
                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '8px 0' }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <span>Grand Total</span>
                    <span style={{ color: 'var(--color-brand-primary)' }}>{formatCurrency(effectiveGrandTotal, currency)}</span>
                  </div>
                </div>

                <Link
                  to={bPath('/checkout')}
                  className="btn btn-primary btn-pill"
                  style={{ width: '100%', marginTop: '24px', padding: '14px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  Proceed to Checkout <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
