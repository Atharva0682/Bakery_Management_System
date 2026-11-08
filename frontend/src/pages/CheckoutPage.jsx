import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { QrCode as QrIcon, Banknote, MapPin, Clock, CheckCircle, AlertCircle, ArrowLeft, Loader2, Sparkles, User, ShieldCheck, Plus, UploadCloud, Image as ImageIcon, Trash2, Calendar } from 'lucide-react';
import { QRCode } from 'antd';
import { useCart } from '../context/CartContext';
import { useBusiness } from '../context/BusinessContext';
import { useQr } from '../context/QrContext';
import { useAuth } from '../context/AuthContext';
import customerService from '../services/customerService';
import { formatCurrency } from '../utils/formatters';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const {
    items,
    subtotal,
    deliveryFee: cartDeliveryFee,
    standardDeliveryFee,
    deliveryFeeSaved,
    deliveryMethod: cartDeliveryMethod,
    setDeliveryMethod: setCartDeliveryMethod,
    taxFee,
    discountAmount,
    grandTotal: cartGrandTotal,
    clearCart,
  } = useCart();
  const { business, name, currency, slug, upiVpa } = useBusiness();
  const { locationTag, qrType, qrCode, hasTableContext } = useQr();
  const { user, isAuthenticated } = useAuth();

  // Deliveries are not immediate: schedule date and batch time slot
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const maxDateStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const [deliveryMethod, setDeliveryMethodState] = useState(cartDeliveryMethod || (hasTableContext ? 'dine_in' : 'delivery'));

  const setDeliveryMethod = (method) => {
    setDeliveryMethodState(method);
    if (setCartDeliveryMethod) {
      setCartDeliveryMethod(method);
    }
  };

  useEffect(() => {
    if (cartDeliveryMethod && cartDeliveryMethod !== deliveryMethod) {
      setDeliveryMethodState(cartDeliveryMethod);
    }
  }, [cartDeliveryMethod]);

  // Calculate effective delivery fee & total so self delivery minuses the delivery charges:
  const isSelfDelivery = deliveryMethod === 'pickup' || deliveryMethod === 'dine_in';
  const effectiveDeliveryFee = isSelfDelivery ? 0 : cartDeliveryFee;
  const effectiveDeliveryFeeSaved = isSelfDelivery ? deliveryFeeSaved : 0;
  const effectiveGrandTotal = Math.max(0, subtotal + effectiveDeliveryFee + taxFee - discountAmount);
  const [deliveryDate, setDeliveryDate] = useState(tomorrowStr);
  const [deliverySlot, setDeliverySlot] = useState('Morning Fresh Batch (08:00 AM - 11:00 AM)');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);

  // Payment Screenshot state (replaces UTR)
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [screenshotFileName, setScreenshotFileName] = useState('');

  const handleScreenshotChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Screenshot file size must be under 8MB.');
      return;
    }

    setScreenshotFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPaymentScreenshot(reader.result);
      setErrorMessage(null);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected screenshot. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  // Saved Addresses state for delivery orders
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    label: 'Home',
    address_line1: '',
    address_line2: '',
    city: 'Mumbai',
    postal_code: '',
    contact_phone: user?.phone || '',
    is_default: true,
  });
  const [isSavingNewAddress, setIsSavingNewAddress] = useState(false);
  const [newAddressError, setNewAddressError] = useState('');

  // Guest checkout state (allows ordering without logging in)
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [guestCity, setGuestCity] = useState('Mumbai');
  const [guestPostalCode, setGuestPostalCode] = useState('400050');

  // Active business dynamic UPI VPA configuration from BusinessContext / API (never hardcoded)
  const activeUpiVpa = upiVpa || business?.upiVpa || business?.upi_vpa || null;

  // Fetch saved customer addresses
  useEffect(() => {
    let isMounted = true;
    const fetchAddresses = async () => {
      setIsLoadingAddresses(true);
      try {
        const res = await customerService.getCustomerAddresses();
        if (isMounted && res.success && res.data) {
          setSavedAddresses(res.data);
          const def = res.data.find((a) => a.is_default) || res.data[0];
          if (def) {
            setSelectedAddressId(def.id);
          }
        }
      } catch (err) {
        console.warn('Addresses load warning:', err.message);
      } finally {
        if (isMounted) setIsLoadingAddresses(false);
      }
    };
    if (isAuthenticated) {
      fetchAddresses();
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Handle Quick Add Address inside Checkout
  const handleSaveNewAddress = async (e) => {
    e.preventDefault();
    setNewAddressError('');
    if (
      !newAddressForm.address_line1.trim() ||
      !newAddressForm.city.trim() ||
      !newAddressForm.postal_code.trim() ||
      !newAddressForm.contact_phone.trim()
    ) {
      setNewAddressError('Please fill in all required address fields.');
      return;
    }
    setIsSavingNewAddress(true);
    try {
      const res = await customerService.createCustomerAddress({
        label: newAddressForm.label,
        address_line1: newAddressForm.address_line1.trim(),
        address_line2: newAddressForm.address_line2 ? newAddressForm.address_line2.trim() : null,
        city: newAddressForm.city.trim(),
        postal_code: newAddressForm.postal_code.trim(),
        contact_phone: newAddressForm.contact_phone.trim(),
        is_default: newAddressForm.is_default,
      });
      if (res.success && res.data) {
        const refreshed = await customerService.getCustomerAddresses();
        if (refreshed.success) {
          setSavedAddresses(refreshed.data);
          setSelectedAddressId(res.data.id);
        }
        setShowAddAddressModal(false);
      }
    } catch (err) {
      setNewAddressError(err.message || 'Failed to save address.');
    } finally {
      setIsSavingNewAddress(false);
    }
  };

  // Handle Order Placement with Double-Submission Lock & Server Validation
  const handlePlaceOrder = async () => {
    if (isSubmitting) return; // Prevent duplicate submission
    if (!items || items.length === 0) {
      setErrorMessage('Your cart is empty. Add items before checking out.');
      return;
    }

    if (!isAuthenticated) {
      if (!guestName.trim()) {
        setErrorMessage('Please enter your full name for order pickup/delivery.');
        return;
      }
      if (!guestPhone.trim()) {
        setErrorMessage('Please enter your phone number so we can contact you regarding your fresh bake.');
        return;
      }
      if (deliveryMethod === 'delivery' && !guestAddress.trim()) {
        setErrorMessage('Please enter your delivery street address.');
        return;
      }
    }

    if (paymentMethod === 'upi' && !activeUpiVpa) {
      setErrorMessage('UPI payment is temporarily unavailable for this bakery because no verified payment destination is configured. Please select another payment method.');
      return;
    }

    if (paymentMethod === 'upi') {
      if (!paymentScreenshot) {
        setErrorMessage('Payment screenshot is required for UPI orders. Please upload your payment confirmation screenshot.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const orderPayload = {
        order_type: deliveryMethod,
        address_id: deliveryMethod === 'delivery' ? (selectedAddressId || undefined) : undefined,
        delivery_date: deliveryDate,
        delivery_time_slot: deliverySlot,
        payment_method: paymentMethod === 'upi' ? 'QR_UPI' : 'CASH_ON_DELIVERY',
        special_instructions: specialInstructions.trim() || undefined,
        table_tag: hasTableContext ? locationTag : undefined,
        qr_code: qrCode || undefined,
        qr_type: qrType || undefined,
        guest_name: !isAuthenticated ? guestName.trim() : (user?.name || undefined),
        guest_phone: !isAuthenticated ? guestPhone.trim() : (user?.phone || undefined),
        delivery_address: !isAuthenticated && deliveryMethod === 'delivery'
          ? `${guestAddress.trim()}, ${guestCity.trim()} - ${guestPostalCode.trim()}`
          : undefined,
        screenshot: paymentScreenshot,
        items: items.map((item) => ({
          product_id: item.productId,
          product_variant_id: item.variantId || undefined,
          quantity: item.quantity,
          note: item.note || undefined,
        })),
      };

      const res = await customerService.createOrder(orderPayload);

      if (res && (res.success || res.data)) {
        const orderData = res.data || res;
        // ONLY clear cart after server confirms order creation
        clearCart();
        setCreatedOrder(orderData);
      } else {
        throw new Error(res?.message || 'Server rejected order creation.');
      }
    } catch (err) {
      // Cart remains intact on error!
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Unable to complete order. Please check your items and try again.';
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // SUCCESS STATE (FIGMA ORDER CONFIRMATION)
  // ==========================================
  if (createdOrder) {
    const tokenQuery = createdOrder.tracking_token ? `?t=${encodeURIComponent(createdOrder.tracking_token)}` : '';
    const trackingUrl = slug
      ? `/b/${slug}/order-tracking/${createdOrder.order_no || createdOrder.id}${tokenQuery}`
      : `/order-tracking/${createdOrder.order_no || createdOrder.id}${tokenQuery}`;
    const menuUrl = slug ? `/b/${slug}/menu` : '/menu';
    const isPendingVerification = createdOrder.payment_status === 'Pending Verification';

    return (
      <div style={{ padding: '40px 0 80px' }}>
        <div className="container" style={{ maxWidth: '780px' }}>
          {/* Stepper with all 4 steps completed */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '32px', fontSize: '14px', fontWeight: 600 }}>
            <span style={{ color: '#2E7D32' }}>✓ 1 Delivery</span>
            <span style={{ color: '#2E7D32' }}>✓ 2 Address</span>
            <span style={{ color: '#2E7D32' }}>✓ 3 Schedule</span>
            <span style={{ color: '#2E7D32' }}>✓ 4 Payment</span>
          </div>

          <div className="card" style={{ padding: '36px', textAlign: 'center', marginBottom: '24px', boxShadow: 'var(--shadow-md)' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: '#E8F5E9',
                color: '#2E7D32',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <CheckCircle size={44} />
            </div>

            <h1 className="font-serif" style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Order Placed Successfully!
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '520px', margin: '0 auto 24px' }}>
              Thank you for ordering with <strong style={{ color: 'var(--color-brand-primary)' }}>{name || 'the bakery'}</strong>.
              Your order has been queued for production.
            </p>

            {/* Verification Notice Banner */}
            {isPendingVerification && (
              <div
                style={{
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FCD34D',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'left',
                  fontSize: '13px',
                }}
              >
                <ShieldCheck size={20} style={{ flexShrink: 0, color: '#B45309' }} />
                <div>
                  <strong>Payment Verification Pending:</strong> Your UPI payment confirmation has been recorded.
                  The bakery staff will verify the incoming transfer{activeUpiVpa ? <> to <strong>{activeUpiVpa}</strong></> : ''} before order fulfillment.
                </div>
              </div>
            )}

            {/* Authoritative Order Details Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface-soft)',
                border: '1px solid var(--border-medium)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'left',
                marginBottom: '28px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Authoritative Order Number</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    #{createdOrder.order_no || createdOrder.id}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      backgroundColor: '#E0F2FE',
                      color: '#0369A1',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    {createdOrder.order_status || 'Order Placed'}
                  </span>

                  <span
                    style={{
                      backgroundColor: isPendingVerification ? '#FEF3C7' : '#D1FAE5',
                      color: isPendingVerification ? '#B45309' : '#065F46',
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    {createdOrder.payment_status || 'Pending Verification'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '14px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Fulfillment</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {createdOrder.order_type === 'dine_in'
                      ? `Dine-in (${createdOrder.table_tag || locationTag || 'Table Service'})`
                      : createdOrder.order_type === 'pickup'
                      ? 'Self Pickup at Counter'
                      : 'Home Delivery'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Timing</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {createdOrder.delivery_time_slot || 'Now (30-45 mins)'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Payment Mode</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {createdOrder.payment_method || 'QR_UPI'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Authoritative Total</span>
                  <strong style={{ color: 'var(--color-brand-primary)', fontSize: '16px' }}>
                    {formatCurrency(createdOrder.total_amount, currency)}
                  </strong>
                </div>

                {(createdOrder.delivery_date || deliveryDate) && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Scheduled Delivery</span>
                    <strong style={{ color: '#166534', fontSize: '13px' }}>
                      {new Date(createdOrder.delivery_date || deliveryDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} • {createdOrder.delivery_time_slot || deliverySlot}
                    </strong>
                  </div>
                )}

                {(createdOrder.transaction_id || createdOrder.payment?.qr_reference_code || transactionId) && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Payment Confirmation Ref</span>
                    <strong style={{ color: '#0369A1', fontFamily: 'monospace', fontSize: '13px' }}>
                      {createdOrder.transaction_id || createdOrder.payment?.qr_reference_code || transactionId}
                    </strong>
                  </div>
                )}

                {(createdOrder.guest_name || guestName) && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '2px' }}>Customer Contact</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                      {createdOrder.guest_name || guestName} ({createdOrder.guest_phone || guestPhone})
                    </strong>
                  </div>
                )}
              </div>

              {/* Server-verified items */}
              {createdOrder.items && createdOrder.items.length > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Order Items Confirmed by Server:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {createdOrder.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span>{item.product_name || item.name || 'Artisanal Baked Item'} × {item.quantity}</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(item.subtotal || item.unit_price * item.quantity, currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to={trackingUrl} className="btn btn-primary btn-pill" style={{ padding: '14px 28px', fontSize: '15px' }}>
                Track Your Order
              </Link>
              <Link to={menuUrl} className="btn btn-secondary btn-pill" style={{ padding: '14px 28px', fontSize: '15px' }}>
                Browse More Delights
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // EMPTY CART STATE
  // ==========================================
  if (!items || items.length === 0) {
    const menuPath = slug ? `/b/${slug}/menu` : '/menu';
    return (
      <div style={{ padding: '60px 0 100px' }}>
        <div className="container" style={{ maxWidth: '580px', textAlign: 'center' }}>
          <div className="card" style={{ padding: '48px 24px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: 'var(--text-muted)',
              }}
            >
              <AlertCircle size={32} />
            </div>
            <h2 className="font-serif" style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Your Cart is Empty
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              Select delicious freshly baked croissants, cakes, and treats before proceeding to checkout.
            </p>
            <Link to={menuPath} className="btn btn-primary btn-pill">
              Explore Our Artisanal Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // STANDARD CHECKOUT VIEW (FIGMA LAYOUT)
  // ==========================================
  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Stepper matching Figma 1 Delivery 2 Address 3 Schedule 4 Payment */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '36px', fontSize: '14px', fontWeight: 600 }}>
          <span style={{ color: 'var(--color-brand-primary)' }}>1 Delivery</span>
          <span style={{ color: 'var(--color-brand-primary)' }}>2 Address</span>
          <span style={{ color: 'var(--color-brand-primary)' }}>3 Schedule</span>
          <span style={{ color: 'var(--color-brand-primary)' }}>4 Payment</span>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #F87171',
              padding: '14px 20px',
              borderRadius: '12px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '14px',
            }}
          >
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '36px', alignItems: 'start' }}>
          {/* Left Column: Form & Payment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* 1. Delivery Method */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                Choose Delivery Method
              </h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {hasTableContext && (
                  <button
                    type="button"
                    className="btn btn-pill"
                    onClick={() => setDeliveryMethod('dine_in')}
                    style={{
                      flex: 1,
                      backgroundColor: deliveryMethod === 'dine_in' ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                      color: deliveryMethod === 'dine_in' ? '#FFFFFF' : 'var(--text-primary)',
                      border: '1px solid var(--border-medium)',
                    }}
                  >
                    Dine-in ({locationTag})
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-pill"
                  onClick={() => setDeliveryMethod('delivery')}
                  style={{
                    flex: 1,
                    backgroundColor: deliveryMethod === 'delivery' ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                    color: deliveryMethod === 'delivery' ? '#FFFFFF' : 'var(--text-primary)',
                    border: '1px solid var(--border-medium)',
                  }}
                >
                  Scheduled Delivery ({subtotal >= 500 ? 'Free' : '+₹50'})
                </button>
                <button
                  type="button"
                  className="btn btn-pill"
                  onClick={() => setDeliveryMethod('pickup')}
                  style={{
                    flex: 1,
                    backgroundColor: deliveryMethod === 'pickup' ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                    color: deliveryMethod === 'pickup' ? '#FFFFFF' : 'var(--text-primary)',
                    border: '1px solid var(--border-medium)',
                  }}
                >
                  Self Delivery / Pickup (No fee - Save ₹50)
                </button>
              </div>

              {deliveryMethod === 'pickup' && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <CheckCircle size={18} style={{ flexShrink: 0, color: '#16A34A' }} />
                  <div>
                    <strong>Self Delivery Applied:</strong> Delivery charges have been minused from your total amount. Pick up fresh at our bakery counter!
                  </div>
                </div>
              )}
            </div>

            {/* 2. Select Delivery Address / Guest Details */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {deliveryMethod === 'dine_in'
                    ? 'Table Service Station'
                    : deliveryMethod === 'pickup'
                    ? 'Bakery Pickup Counter'
                    : isAuthenticated ? 'Select Delivery Address' : 'Customer & Delivery Information'}
                </h3>
                {deliveryMethod === 'delivery' && isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewAddressError('');
                      setShowAddAddressModal(true);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-brand-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  >
                    + Add New
                  </button>
                )}
              </div>

              {!isAuthenticated ? (
                /* Guest Customer Details Form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    backgroundColor: '#F5EFEB',
                    border: '1px solid #E8DFD5',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <span>⚡ <strong>Guest Checkout:</strong> Order immediately without creating an account.</span>
                    <button
                      type="button"
                      onClick={() => navigate(slug ? `/b/${slug}/login` : '/login', { state: { from: { pathname: window.location.pathname } } })}
                      style={{ background: 'none', border: 'none', color: 'var(--color-brand-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                    >
                      Already have an account? Sign in →
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        Your Full Name <span style={{ color: '#D97706' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g. Priya Sharma"
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-medium)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        Mobile Phone Number <span style={{ color: '#D97706' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="e.g. +91 98201 54321"
                        required
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          fontSize: '14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-medium)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {deliveryMethod === 'delivery' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                          Delivery Street Address <span style={{ color: '#D97706' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={guestAddress}
                          onChange={(e) => setGuestAddress(e.target.value)}
                          placeholder="e.g. Flat 402, Sea Breeze Apts, 14th Road, Bandra West"
                          required
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            fontSize: '14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-medium)',
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                            City
                          </label>
                          <input
                            type="text"
                            value={guestCity}
                            onChange={(e) => setGuestCity(e.target.value)}
                            placeholder="Mumbai"
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              fontSize: '14px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-medium)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                            PIN Code
                          </label>
                          <input
                            type="text"
                            value={guestPostalCode}
                            onChange={(e) => setGuestPostalCode(e.target.value)}
                            placeholder="400050"
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              fontSize: '14px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-medium)',
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {deliveryMethod === 'dine_in' && (
                    <div style={{ border: '1px solid #E8DFD5', borderRadius: '10px', padding: '12px 14px', backgroundColor: '#FAF6F0', fontSize: '13px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-brand-primary)' }}>Table Service: </span>
                      {locationTag || 'Dine-in Table'} — Fresh bakes will be brought right to your seat.
                    </div>
                  )}

                  {deliveryMethod === 'pickup' && (
                    <div style={{ border: '1px solid #E8DFD5', borderRadius: '10px', padding: '12px 14px', backgroundColor: '#FAF6F0', fontSize: '13px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-brand-primary)' }}>Counter Pickup: </span>
                      Collect at {name || 'Bakery'} main counter once notified on {guestPhone || 'your phone'}.
                    </div>
                  )}
                </div>
              ) : deliveryMethod === 'dine_in' ? (
                <div style={{ border: '2px solid var(--color-brand-primary)', borderRadius: '12px', padding: '16px', backgroundColor: '#FDF9F5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <MapPin size={16} color="var(--color-brand-primary)" />
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>
                      {locationTag || 'Dine-in Table'}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '24px' }}>
                    Order will be brought to {locationTag || 'your table'} fresh from the oven.
                  </p>
                </div>
              ) : deliveryMethod === 'pickup' ? (
                <div style={{ border: '2px solid var(--color-brand-primary)', borderRadius: '12px', padding: '16px', backgroundColor: '#FDF9F5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <MapPin size={16} color="var(--color-brand-primary)" />
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>
                      {name || 'Bakery'} Main Kitchen Counter
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '24px' }}>
                    Pick up counter at main entrance. Your items will be packaged and ready for collection.
                  </p>
                </div>
              ) : savedAddresses.length > 0 ? (
                (() => {
                  const currentSelected = savedAddresses.find((a) => a.id === selectedAddressId) || savedAddresses[0];

                  return (
                    <div>
                      {/* Current Selected Address Card */}
                      <div style={{ border: '2px solid var(--color-brand-primary)', borderRadius: '12px', padding: '16px', backgroundColor: '#FDF9F5', marginBottom: savedAddresses.length > 1 ? '14px' : '0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MapPin size={16} color="var(--color-brand-primary)" />
                            <span style={{ fontWeight: 600, fontSize: '15px' }}>
                              {currentSelected.label || 'Home'}
                              {currentSelected.is_default && ' (Default)'}
                            </span>
                          </div>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '24px', lineHeight: 1.4 }}>
                          {currentSelected.address_line1}
                          {currentSelected.address_line2 ? `, ${currentSelected.address_line2}` : ''}, {currentSelected.city} - {currentSelected.postal_code}
                        </p>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '24px', marginTop: '4px' }}>
                          Contact: {currentSelected.contact_phone}
                        </div>
                      </div>

                      {/* Multiple Addresses Selector Pill / Dropdown */}
                      {savedAddresses.length > 1 && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                            Or choose from your saved addresses:
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {savedAddresses.map((addr) => (
                              <button
                                key={addr.id}
                                type="button"
                                onClick={() => setSelectedAddressId(addr.id)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  border: selectedAddressId === addr.id ? '2px solid var(--color-brand-primary)' : '1px solid var(--border-medium)',
                                  backgroundColor: selectedAddressId === addr.id ? 'rgba(90, 56, 37, 0.08)' : 'var(--bg-surface)',
                                  color: selectedAddressId === addr.id ? 'var(--color-brand-primary)' : 'var(--text-secondary)',
                                }}
                              >
                                {addr.label} {addr.is_default ? '★' : ''} ({addr.city})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div style={{ border: '1px dashed var(--border-medium)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    No delivery address saved yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAddressError('');
                      setShowAddAddressModal(true);
                    }}
                    className="btn btn-outline"
                    style={{ fontSize: '13px' }}
                  >
                    + Add Delivery Address
                  </button>
                </div>
              )}

              {/* Customer Contact Badge */}
              {isAuthenticated && (
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <User size={15} />
                  <span>Ordering as: <strong style={{ color: 'var(--text-primary)' }}>{user?.name || 'Customer'}</strong> ({user?.phone || '+91 98201 54321'})</span>
                </div>
              )}
            </div>

            {/* 3. Schedule Delivery Date & Batch Time Slot (Deliveries not immediate) */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Calendar size={18} color="var(--color-brand-primary)" />
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Choose Delivery Date & Batch Slot
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Deliveries are scheduled according to our fresh oven production batches (earliest starting tomorrow).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Delivery Date <span style={{ color: '#D97706' }}>*</span>
                  </label>
                  <input
                    type="date"
                    min={tomorrowStr}
                    max={maxDateStr}
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Available stock & fresh batch scheduled for {deliveryDate}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Time Slot (Planned Batches) <span style={{ color: '#D97706' }}>*</span>
                  </label>
                  <select
                    value={deliverySlot}
                    onChange={(e) => setDeliverySlot(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  >
                    <option value="Morning Fresh Batch (08:00 AM - 11:00 AM)">Morning Fresh Batch (08:00 AM - 11:00 AM)</option>
                    <option value="Afternoon Batch (12:00 PM - 03:00 PM)">Afternoon Batch (12:00 PM - 03:00 PM)</option>
                    <option value="Evening Warm Batch (04:00 PM - 07:00 PM)">Evening Warm Batch (04:00 PM - 07:00 PM)</option>
                    <option value="Night Closing Batch (07:30 PM - 10:00 PM)">Night Closing Batch (07:30 PM - 10:00 PM)</option>
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Peak oven-to-door freshness guaranteed.
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Special Instructions (Customer Notes) */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                Order Notes / Special Requests (Optional)
              </h3>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Please leave at door, pack warm, eggless packaging, ring doorbell"
                rows={2}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* 5. Payment Method (UPI & Pay On Delivery Only - No Cards) */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Choose Payment Method</h3>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                {[
                  { id: 'upi', label: 'UPI / Scan QR & Screenshot', icon: <QrIcon size={18} /> },
                  { id: 'cash', label: 'Pay On Delivery', icon: <Banknote size={18} /> },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className="btn btn-pill"
                    style={{
                      flex: 1,
                      backgroundColor: paymentMethod === pm.id ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                      color: paymentMethod === pm.id ? '#FFFFFF' : 'var(--text-primary)',
                      border: '1px solid var(--border-medium)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      padding: '12px',
                    }}
                  >
                    {pm.icon} {pm.label}
                  </button>
                ))}
              </div>

              {/* Dynamic QR Scanner Box matching Active Business UPI Configuration */}
              {paymentMethod === 'upi' && (
                activeUpiVpa ? (
                  <div style={{ border: '1px dashed #DCCEC1', borderRadius: '16px', padding: '24px', textAlign: 'center', backgroundColor: '#FDF9F5' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Scan QR Code & Upload Screenshot</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '440px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                      Scan this BHIM UPI QR using GooglePay, PhonePe, Paytm or any UPI app, complete payment, and upload your screenshot below.
                    </p>
                    <div style={{ display: 'inline-block', backgroundColor: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ width: '180px', height: '180px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <QRCode
                          value={`upi://pay?pa=${activeUpiVpa}&pn=${encodeURIComponent(name || 'Bakery')}&am=${effectiveGrandTotal}&cu=INR&tn=${encodeURIComponent('Order ' + (name || 'Bakery'))}`}
                          size={180}
                          bordered={false}
                          color="#2E221D"
                        />
                      </div>
                      <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
                        UPI ID: {activeUpiVpa}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Amount to Pay: {formatCurrency(effectiveGrandTotal, currency)}
                      </div>
                    </div>

                    {/* Screenshot Upload Section (Instead of UTR) */}
                    <div style={{ marginTop: '24px', maxWidth: '480px', margin: '24px auto 16px', textAlign: 'left' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Payment Screenshot <span style={{ color: '#D97706' }}>* (Mandatory Proof)</span>
                      </label>

                      {paymentScreenshot ? (
                        <div style={{
                          border: '2px solid #059669',
                          borderRadius: '12px',
                          padding: '16px',
                          backgroundColor: '#F0FDF4',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <img
                              src={paymentScreenshot}
                              alt="Payment Screenshot Preview"
                              style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #A7F3D0' }}
                            />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#065F46' }}>
                                ✓ Screenshot Attached
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {screenshotFileName || 'payment_proof.jpg'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentScreenshot(null);
                              setScreenshotFileName('');
                            }}
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: '12px', color: '#DC2626', borderColor: '#FCA5A5' }}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          border: '2px dashed var(--border-medium)',
                          borderRadius: '12px',
                          padding: '24px 16px',
                          textAlign: 'center',
                          backgroundColor: '#FFFFFF',
                          cursor: 'pointer',
                        }}>
                          <UploadCloud size={32} color="var(--color-brand-primary)" style={{ margin: '0 auto 8px' }} />
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            Click to upload payment screenshot
                          </p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            Supports PNG, JPG, JPEG or WEBP (Max 8MB)
                          </p>
                          <label
                            style={{
                              display: 'inline-block',
                              padding: '8px 18px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--color-brand-primary)',
                              color: '#FFFFFF',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Browse Screenshot
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleScreenshotChange}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>
                      )}

                      {/* 30-Day Auto Deletion Privacy Notice */}
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#1E40AF',
                        lineHeight: 1.4
                      }}>
                        🛡️ <strong>Auto-Privacy Policy:</strong> Uploaded payment screenshots are stored only for order verification and are <strong>automatically and permanently deleted after 30 days</strong>.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handlePlaceOrder}
                      disabled={isSubmitting || !paymentScreenshot}
                      className="btn btn-primary btn-pill"
                      style={{
                        padding: '12px 28px',
                        fontSize: '15px',
                        fontWeight: 600,
                        opacity: !paymentScreenshot ? 0.6 : 1,
                        cursor: !paymentScreenshot ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSubmitting ? 'Recording Payment...' : !paymentScreenshot ? 'Upload Screenshot to Proceed' : "I've Paid & Verify Order"}
                    </button>
                  </div>
                ) : (
                  <div
                    id="upi-unavailable-notice"
                    style={{
                      border: '1px solid #FED7AA',
                      borderRadius: '16px',
                      padding: '24px',
                      textAlign: 'center',
                      backgroundColor: '#FFFBEB',
                    }}
                  >
                    <AlertCircle size={36} color="#D97706" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#92400E' }}>
                      Payment Temporarily Unavailable
                    </h4>
                    <p style={{ fontSize: '13px', color: '#B45309', maxWidth: '440px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                      UPI payment is temporarily unavailable because no verified UPI destination is configured for this bakery. Please select <strong>Pay On Delivery</strong> to proceed with your order.
                    </p>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className="btn btn-secondary btn-pill"
                      style={{ padding: '8px 20px', fontSize: '13px' }}
                    >
                      Switch to Pay On Delivery
                    </button>
                  </div>
                )
              )}

              {paymentMethod !== 'upi' && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', textAlign: 'center' }}>
                  Pay cash on delivery when your scheduled fresh batch arrives at your doorstep.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary matching Figma */}
          <div className="card" style={{ padding: '24px', position: 'sticky', top: '90px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Order Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {item.name} {item.variant ? `(${item.variant})` : ''} × {item.quantity}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatCurrency(item.price * item.quantity, currency)}
                  </span>
                </div>
              ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '16px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Delivery Fee</span>
                <span>
                  {deliveryMethod === 'delivery' ? (
                    effectiveDeliveryFee === 0 ? 'FREE' : formatCurrency(effectiveDeliveryFee, currency)
                  ) : (
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>FREE (Self Delivery)</span>
                  )}
                </span>
              </div>
              {effectiveDeliveryFeeSaved > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontWeight: 600, fontSize: '13px' }}>
                  <span>Self Delivery Waiver</span>
                  <span>-{formatCurrency(effectiveDeliveryFeeSaved, currency)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Product GST</span>
                <span>{formatCurrency(taxFee, currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2E7D32', fontWeight: 600 }}>
                  <span>Promo Discount</span>
                  <span>-{formatCurrency(discountAmount, currency)}</span>
                </div>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '16px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
              <span>To Pay</span>
              <span style={{ color: 'var(--color-brand-primary)' }}>{formatCurrency(effectiveGrandTotal, currency)}</span>
            </div>

            <button
              type="button"
              id="place-order-btn"
              onClick={handlePlaceOrder}
              disabled={isSubmitting || (paymentMethod === 'upi' && (!activeUpiVpa || !paymentScreenshot))}
              className="btn btn-primary btn-pill"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                cursor: isSubmitting || (paymentMethod === 'upi' && (!activeUpiVpa || !paymentScreenshot)) ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || (paymentMethod === 'upi' && (!activeUpiVpa || !paymentScreenshot)) ? 0.65 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />{' '}
                  {paymentMethod === 'upi' ? 'Recording Payment...' : 'Placing Order...'}
                </>
              ) : paymentMethod === 'upi' ? (
                !activeUpiVpa ? (
                  'UPI Payment Unavailable'
                ) : !paymentScreenshot ? (
                  'Upload Screenshot to Place Order'
                ) : (
                  `I've Paid & Verify • ${formatCurrency(effectiveGrandTotal, currency)}`
                )
              ) : (
                `Place Order • ${formatCurrency(effectiveGrandTotal, currency)}`
              )}
            </button>

            {!isAuthenticated && (
              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                ⚡ Ordering as Guest • Your phone number will receive delivery & status alerts
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK ADD ADDRESS MODAL */}
      {showAddAddressModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(31, 22, 16, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Add Delivery Address
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              Enter your address for direct bakery doorstep delivery.
            </p>

            {newAddressError && (
              <div
                style={{
                  backgroundColor: '#FFEBEE',
                  color: '#C62828',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                {newAddressError}
              </div>
            )}

            <form onSubmit={handleSaveNewAddress} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Label
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['Home', 'Work', 'Other'].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setNewAddressForm({ ...newAddressForm, label: lbl })}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: newAddressForm.label === lbl ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                        color: newAddressForm.label === lbl ? '#FFFFFF' : 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Flat / House / Building / Street *
                </label>
                <input
                  type="text"
                  className="input"
                  value={newAddressForm.address_line1}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, address_line1: e.target.value })}
                  placeholder="e.g. Flat 402, Sea Breeze Apartments"
                  required
                  style={{ width: '100%', minHeight: '44px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Area / Landmark (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  value={newAddressForm.address_line2}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, address_line2: e.target.value })}
                  placeholder="e.g. Carter Road, Bandra West"
                  style={{ width: '100%', minHeight: '44px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={newAddressForm.city}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                    placeholder="e.g. Mumbai"
                    required
                    style={{ width: '100%', minHeight: '44px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input"
                    value={newAddressForm.postal_code}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, postal_code: e.target.value })}
                    placeholder="e.g. 400050"
                    required
                    style={{ width: '100%', minHeight: '44px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Contact Phone *
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  className="input"
                  value={newAddressForm.contact_phone}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, contact_phone: e.target.value })}
                  placeholder="+91 98201 54321"
                  required
                  style={{ width: '100%', minHeight: '44px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddAddressModal(false)}
                  className="btn btn-outline"
                  disabled={isSavingNewAddress}
                  style={{ minHeight: '44px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingNewAddress}
                  style={{ minHeight: '44px', minWidth: '120px' }}
                >
                  {isSavingNewAddress ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
