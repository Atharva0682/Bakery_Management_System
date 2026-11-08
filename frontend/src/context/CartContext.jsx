import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useBusiness } from './BusinessContext';
import { useQr } from './QrContext';

const CartContext = createContext();

const MAX_ITEM_QUANTITY = 99;

/**
 * Safely reads cart data from localStorage with corruption recovery
 */
const loadPersistedCart = (slug) => {
  if (!slug) return [];
  const key = `crumb_cart_${slug}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`Corrupted cart in ${key}, resetting.`);
      localStorage.removeItem(key);
      return [];
    }
    // Filter and sanitize items to ensure valid structure
    return parsed.filter(
      (item) => item && item.id && item.productId && Number(item.quantity) > 0 && !isNaN(item.price)
    );
  } catch (e) {
    console.warn(`Error reading persisted cart for ${slug}:`, e);
    try {
      localStorage.removeItem(key);
    } catch {}
    return [];
  }
};

/**
 * Safely saves cart data to localStorage
 */
const savePersistedCart = (slug, items) => {
  if (!slug) return;
  const key = `crumb_cart_${slug}`;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.warn(`Failed to persist cart for ${slug}:`, e);
  }
};

export const CartProvider = ({ children }) => {
  const { slug, businessId, business } = useBusiness();
  const { locationTag, qrType, hasTableContext } = useQr();

  const defaultSlug = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'crumbandco';
  const currentSlug = slug || defaultSlug;

  // State for items scoped to current business slug
  const [items, setItems] = useState(() => loadPersistedCart(currentSlug));
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Delivery fulfillment method: 'delivery', 'pickup' (self delivery), or 'dine_in'
  const [deliveryMethod, setDeliveryMethod] = useState(() => (hasTableContext ? 'dine_in' : 'delivery'));

  useEffect(() => {
    if (hasTableContext) {
      setDeliveryMethod('dine_in');
    }
  }, [hasTableContext]);

  // Synchronize cart when active business changes
  useEffect(() => {
    const loaded = loadPersistedCart(currentSlug);
    setItems(loaded);
  }, [currentSlug]);

  // Persist items whenever they change
  useEffect(() => {
    savePersistedCart(currentSlug, items);
  }, [items, currentSlug]);

  // Total quantity of items in cart
  const totalItemCount = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  }, [items]);

  // Distinct line item count
  const totalDistinctCount = items.length;

  // Subtotal calculated strictly from item quantities and display prices
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  }, [items]);

  // Standard delivery fee configured by owner (default ₹50)
  const standardDeliveryFee = useMemo(() => {
    return Number(business?.pricing?.delivery_fee ?? 50);
  }, [business?.pricing]);

  const isSelfDelivery = deliveryMethod === 'pickup' || deliveryMethod === 'dine_in';

  // Delivery charge calculation:
  // - Highest applicable delivery fee once across all ordered products
  // - Product-specific delivery fee overrides standard fee when configured
  // - Free delivery threshold applies if order subtotal qualifies
  const calculatedDeliveryCharge = useMemo(() => {
    if (items.length === 0) return 0;
    const threshold = Number(business?.pricing?.free_delivery_threshold ?? 500);
    if (threshold > 0 && subtotal >= threshold) return 0;

    const baseFee = Number(business?.pricing?.delivery_fee ?? 50);
    const applicableFees = items.map((item) => {
      return (item.delivery_fee !== null && item.delivery_fee !== undefined && item.delivery_fee !== '')
        ? Number(item.delivery_fee)
        : baseFee;
    });
    return Math.max(...applicableFees);
  }, [items, subtotal, business?.pricing]);

  // Effective delivery fee: ₹0 when user chooses self delivery / pickup or dine_in
  const deliveryFee = useMemo(() => {
    if (isSelfDelivery) return 0;
    return calculatedDeliveryCharge;
  }, [isSelfDelivery, calculatedDeliveryCharge]);

  // Delivery charges deducted / saved when choosing self delivery
  const deliveryFeeSaved = useMemo(() => {
    if (isSelfDelivery && calculatedDeliveryCharge > 0) {
      return calculatedDeliveryCharge;
    }
    return 0;
  }, [isSelfDelivery, calculatedDeliveryCharge]);

  // Product-specific configured GST; the API recalculates trusted totals.
  const taxFee = useMemo(() => {
    return items.reduce((sum, item) => sum + Math.round(Number(item.price) * Number(item.quantity) * Number(item.gst_rate ?? 0)) / 100, 0) + Math.round(deliveryFee * Number(business?.pricing?.delivery_gst_rate ?? 0)) / 100;
  }, [items, deliveryFee, business?.pricing]);

  // Auto-evaluate discount if coupon applied
  useEffect(() => {
    setDiscountAmount(0); // Discount rules must be configured and validated on the server.

  }, [subtotal, appliedCoupon]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal + deliveryFee + taxFee - discountAmount);
  }, [subtotal, deliveryFee, taxFee, discountAmount]);

  /**
   * Adds a product to the cart with variant and option configuration
   */
  const addItem = useCallback(
    (product, variant = null, quantity = 1, options = {}) => {
      if (!product) return { success: false, error: 'INVALID_PRODUCT' };

      // Availability guard
      if (product.is_available === false) {
        return { success: false, error: 'PRODUCT_UNAVAILABLE', message: 'This item is currently sold out.' };
      }

      // Quantity validation
      const numQty = parseInt(quantity, 10);
      if (isNaN(numQty) || numQty <= 0) {
        return { success: false, error: 'INVALID_QUANTITY', message: 'Quantity must be at least 1.' };
      }
      const qtyToAdd = Math.min(numQty, MAX_ITEM_QUANTITY);

      // Business isolation guard: check that product belongs to current active business
      if (product.business_id && businessId && Number(product.business_id) !== Number(businessId)) {
        return {
          success: false,
          error: 'CROSS_TENANT_PRODUCT',
          message: 'Cannot add product from another bakery into this cart.',
        };
      }

      // Stable cart item key based on product ID, variant identifier, and customization options
      const variantName = variant?.name || 'Standard';
      const variantId = variant?.id || variant?.variant_id || null;
      const isEggless = Boolean(options.isEggless);
      const note = options.note || '';

      const itemKey = `item_${product.id}_${variantId || variantName.toLowerCase().replace(/\s+/g, '_')}_${isEggless ? 'eggless' : 'reg'}`;

      // Price determination for display (server will recalculate at checkout)
      const price = Number(variant?.price || variant?.selling_price || product.base_price || product.price) || 0;

      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex((item) => item.id === itemKey);

        if (existingIndex > -1) {
          const updated = [...prevItems];
          const newQty = Math.min(MAX_ITEM_QUANTITY, updated[existingIndex].quantity + qtyToAdd);
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: newQty,
            note: note || updated[existingIndex].note,
          };
          return updated;
        }

        const newItem = {
          id: itemKey,
          productId: product.id,
          name: product.name,
          variant: variantName,
          variantId,
          price,
          gst_rate: Number(product.gst_rate ?? 0),
          delivery_fee: (product.delivery_fee !== null && product.delivery_fee !== undefined && product.delivery_fee !== '') ? Number(product.delivery_fee) : null,
          quantity: qtyToAdd,
          image: product.image_url || product.image || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500',
          isEggless,
          note,
          businessId: product.business_id || businessId,
          businessSlug: currentSlug,
        };

        return [...prevItems, newItem];
      });

      return { success: true };
    },
    [businessId, currentSlug]
  );

  /**
   * Updates quantity of a specific item or removes if <= 0
   */
  const updateQuantity = useCallback((itemId, newQty) => {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      removeItem(itemId);
      return;
    }

    const clampedQty = Math.min(MAX_ITEM_QUANTITY, qty);
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity: clampedQty } : item))
    );
  }, []);

  /**
   * Removes an item from the cart
   */
  const removeItem = useCallback((itemId) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  /**
   * Clears the current business cart
   */
  const clearCart = useCallback(() => {
    setItems([]);
    setDiscountAmount(0);
    try {
      localStorage.removeItem(`crumb_cart_${currentSlug}`);
    } catch {}
  }, [currentSlug]);

  /**
   * Applies promotional coupon
   */
  const applyCoupon = useCallback(
    (code) => {
      if (!code) return { success: false, message: 'Please enter a coupon code' };
      const normalized = code.trim().toUpperCase();
      if (normalized === 'SAVE25' || normalized === 'CRUMB25') {
        setAppliedCoupon(normalized);
        const discount = subtotal > 1000 ? 50 : 0;
        setDiscountAmount(discount);
        return { success: true, message: `Coupon ${normalized} applied!` };
      }
      return { success: false, message: 'Invalid or expired coupon code' };
    },
    [subtotal]
  );

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        totalItemCount,
        totalDistinctCount,
        subtotal,
        deliveryMethod,
        setDeliveryMethod,
        isSelfDelivery,
        standardDeliveryFee,
        deliveryFeeSaved,
        deliveryFee,
        taxFee,
        discountAmount,
        grandTotal,
        appliedCoupon,
        activeBusinessSlug: currentSlug,
        activeBusinessId: businessId,
        stationContext: {
          locationTag: locationTag || null,
          qrType: qrType || null,
          hasTableContext,
        },
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
