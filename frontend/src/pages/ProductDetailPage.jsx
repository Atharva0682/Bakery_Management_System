import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Clock, Plus, Minus, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useBusiness } from '../context/BusinessContext';
import { getProductById, getProducts } from '../services/customerService';
import { formatCurrency } from '../utils/formatters';
import StarRating from '../components/common/StarRating';
import Badge from '../components/common/Badge';

const ProductDetailPage = () => {
  const { slug: productIdentifier } = useParams();
  const { addItem } = useCart();
  const { name, currency, slug: businessSlug, businessId } = useBusiness();

  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [isEggless, setIsEggless] = useState(false);
  const [cakeNote, setCakeNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const bPath = (path) => {
    if (!businessSlug) return path;
    return `/b/${businessSlug}${path === '/' ? '' : path}`;
  };

  const fetchProductDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getProductById(productIdentifier);
      if (res && res.success && res.data) {
        const prod = res.data;
        setProduct(prod);
        if (prod.variants && prod.variants.length > 0) {
          setSelectedVariant(prod.variants[0]);
        }
      } else {
        throw new Error('Product details could not be retrieved.');
      }
    } catch (err) {
      setError({
        code: err.code || 'PRODUCT_NOT_FOUND',
        message: err.message || 'Product not found in this bakery catalog.',
      });
      setProduct(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (productIdentifier) {
      fetchProductDetails();
    }
  }, [productIdentifier, businessId, businessSlug]);

  const getPrice = () => {
    if (selectedVariant) {
      return Number(selectedVariant.price || selectedVariant.selling_price) || 0;
    }
    return Number(product?.base_price) || 0;
  };

  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchRelated = async () => {
      try {
        const res = await getProducts({ limit: 4 });
        if (isMounted && res && res.success && Array.isArray(res.data)) {
          setRelatedProducts(res.data.filter((p) => String(p.id) !== String(productIdentifier)).slice(0, 4));
        }
      } catch (e) {
        console.warn('Could not load related products:', e);
      }
    };
    fetchRelated();
    return () => {
      isMounted = false;
    };
  }, [productIdentifier, businessId, businessSlug]);

  // Loading skeleton matching Figma 2-column layout
  if (isLoading) {
    return (
      <div style={{ padding: '40px 0 80px' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '48px', alignItems: 'start' }}>
            <div className="card" style={{ height: '420px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: 'var(--radius-xl)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ height: '36px', width: '70%', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '6px' }} />
              <div style={{ height: '28px', width: '30%', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '6px' }} />
              <div style={{ height: '80px', width: '100%', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '8px' }} />
              <div style={{ height: '48px', width: '50%', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '9999px' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not Found or Cross-Tenant error state
  if (error || !product) {
    return (
      <div style={{ padding: '60px 0 100px', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '520px' }}>
          <div className="card" style={{ padding: '48px 32px' }}>
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
            <h1 className="font-serif" style={{ fontSize: '26px', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Product Not Available
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.5, marginBottom: '24px' }}>
              {error?.message || `This product does not exist in ${name || 'this bakery'}'s catalog, or belongs to another bakery.`}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link to={bPath('/menu')} className="btn btn-primary btn-pill">
                <ArrowLeft size={16} /> Return to Menu
              </Link>
              <button onClick={fetchProductDetails} className="btn btn-secondary btn-pill">
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAvailable = product.is_available !== false;
  const currentPrice = getPrice();
  const isVeg = product.is_eggless || product.is_veg !== false;
  const displayImage = activeImage || product.image_url || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800';

  return (
    <div style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Back navigation */}
        <Link
          to={bPath('/menu')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-muted)',
            marginBottom: '24px',
            fontSize: '14px',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} /> Back to Artisanal Menu
        </Link>

        {/* 2-Column Product Detail layout matching Figma */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(320px, 1.2fr)', gap: '48px', alignItems: 'start' }}>
          {/* Left: Product Showcase Gallery */}
          <div>
            <div className="card" style={{ overflow: 'hidden', borderRadius: 'var(--radius-xl)', marginBottom: '16px' }}>
              <img
                src={displayImage}
                alt={product.name}
                style={{ width: '100%', height: '420px', objectFit: 'cover' }}
              />
            </div>
            {/* Gallery Thumbnails matching Figma */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                displayImage,
                'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400',
                'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400',
              ].map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveImage(imgUrl)}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: displayImage === imgUrl ? '2px solid var(--color-brand-primary)' : '1px solid var(--border-light)',
                    opacity: displayImage === imgUrl ? 1 : 0.7,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <img src={imgUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Customization & Add to Cart matching Figma */}
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span className={isVeg ? 'dietary-icon-veg' : 'dietary-icon-nonveg'} title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'} />
              <Badge type="fresh">{product.category_name || 'Freshly Baked'}</Badge>
              {product.is_eggless && <Badge type="eggless">100% Eggless Option Available</Badge>}
              {!isAvailable && (
                <span
                  style={{
                    backgroundColor: 'rgba(211, 47, 47, 0.1)',
                    color: 'var(--color-error, #D32F2F)',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Sold Out
                </span>
              )}
            </div>

            <h1 className="font-serif" style={{ fontSize: '36px', color: 'var(--text-primary)', marginBottom: '8px' }}>
              {product.name}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <StarRating rating={product.rating || 4.9} showScore={true} />
              <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
                {formatCurrency(currentPrice, currency)}
              </span>
              {(product.items_per_pack > 1 || product.selling_unit === 'per_pack' || product.standard_weight_grams) && (
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#854D0E', backgroundColor: '#FEF9C3', padding: '4px 10px', borderRadius: '6px' }}>
                  {product.items_per_pack > 1 ? `Pack of ${product.items_per_pack}` : ''}
                  {product.net_weight_per_pack_g ? ` (${product.net_weight_per_pack_g}g)` : (product.standard_weight_grams ? ` (${product.standard_weight_grams}g)` : '')}
                  {product.selling_unit === 'per_pack' && !product.items_per_pack ? 'Per Pack' : ''}
                </span>
              )}
            </div>

            {/* Weight / Variant Selector */}
            {product.variants && product.variants.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Select Weight / Size
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariant(v)}
                        className="btn btn-pill"
                        style={{
                          backgroundColor: isSelected ? 'var(--color-brand-primary-light, #FDF2F4)' : 'var(--bg-surface)',
                          color: isSelected ? 'var(--color-brand-primary)' : 'var(--text-primary)',
                          border: `1.5px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--border-medium)'}`,
                          padding: '10px 20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {v.name} • {formatCurrency(v.price || v.selling_price, currency)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Make it 100% Eggless Toggle Card */}
            {product.is_eggless && (
              <div
                className="card"
                style={{
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isEggless ? 'var(--color-brand-primary-light, #FDF2F4)' : 'var(--bg-surface)',
                  borderColor: isEggless ? 'var(--color-brand-primary)' : 'var(--border-light)',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Make it 100% Eggless
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Prepared using organic eggless substitutes with same delightful texture
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isEggless}
                  onChange={(e) => setIsEggless(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--color-brand-primary)', cursor: 'pointer' }}
                />
              </div>
            )}

            {/* Special Instructions (Cake Note) */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Special Instructions (Name on Cake, Eggless note)
              </label>
              <textarea
                placeholder="E.g. Write 'Happy Birthday Anya!' on cake, pack extra napkins..."
                value={cakeNote}
                onChange={(e) => setCakeNote(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-medium)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  resize: 'none',
                  outline: 'none',
                  backgroundColor: 'var(--bg-surface)',
                }}
              />
            </div>

            {/* Quantity & CTA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-surface-soft)', padding: '8px 16px', borderRadius: '9999px', border: '1px solid var(--border-light)' }}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  disabled={!isAvailable}
                >
                  <Minus size={16} />
                </button>
                <span style={{ fontSize: '16px', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  disabled={!isAvailable}
                >
                  <Plus size={16} />
                </button>
              </div>

              {isAvailable ? (
                <button
                  className="btn btn-primary btn-pill"
                  style={{ flex: 1, padding: '14px', fontSize: '16px', fontWeight: 600 }}
                  onClick={() => {
                    addItem(
                      product,
                      {
                        name: selectedVariant ? selectedVariant.name : 'Standard',
                        selling_price: currentPrice,
                        variant_id: selectedVariant?.id || null,
                      },
                      quantity,
                      { isEggless, note: cakeNote }
                    );
                  }}
                >
                  Add to Cart • {formatCurrency(currentPrice * quantity, currency)}
                </button>
              ) : (
                <button
                  className="btn btn-pill"
                  disabled
                  style={{ flex: 1, padding: '14px', fontSize: '16px', backgroundColor: 'var(--bg-surface-soft)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                >
                  Currently Unavailable
                </button>
              )}
            </div>

            {/* Delivery Guarantee Pill */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Clock size={16} color="var(--color-brand-primary)" />
              Delivering to you in 30-45 mins
            </div>

            {/* Tabs matching Figma */}
            <div style={{ marginTop: '36px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
                {['description', 'ingredients', 'reviews'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '15px',
                      fontWeight: activeTab === tab ? 600 : 400,
                      color: activeTab === tab ? 'var(--color-brand-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      position: 'relative',
                    }}
                  >
                    {tab}
                    {activeTab === tab && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-13px',
                          left: 0,
                          right: 0,
                          height: '2px',
                          backgroundColor: 'var(--color-brand-primary)',
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {activeTab === 'description' && (product.description || 'Sink your teeth into layers of intense dark chocolate sponge filled with premium dark chocolate ganache, glazed to absolute glossy perfection. Prepared with imported premium cocoa and fine quality deck-oven baking techniques that keep it delightfully moist. Perfect for anniversaries, birthdays, or treating your sweet tooth.')}
                {activeTab === 'ingredients' && (product.ingredients || 'Belgian Cocoa, Organic Flour, Unsalted Butter, Pure Madagascar Vanilla, Cane Sugar, Dark Chocolate Ganache.')}
                {activeTab === 'reviews' && `Rated ${product.rating || '4.9'}/5 by 124 verified bakery patrons across Mumbai.`}
              </p>
            </div>
          </div>
        </div>

        {/* You May Also Like Section matching Figma */}
        {relatedProducts.length > 0 && (
          <div style={{ marginTop: '64px', borderTop: '1px solid var(--border-light)', paddingTop: '48px' }}>
            <h2 className="font-serif" style={{ fontSize: '26px', color: 'var(--text-primary)', marginBottom: '24px' }}>
              You May Also Like
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
              {relatedProducts.map((rel) => {
                const relPrice = Number(rel.base_price) || Number(rel.price) || 0;
                return (
                  <div key={rel.id} className="card product-card">
                    <Link to={bPath(`/product/${rel.id}`)} className="product-image-link">
                      <div className="product-image-container" style={{ height: '170px' }}>
                        <img src={rel.image_url || rel.image || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'} alt={rel.name} className="product-image" />
                        <div className="rating-wrap">
                          <StarRating rating={rel.rating || 4.8} showScore={true} />
                        </div>
                      </div>
                    </Link>
                    <div className="product-info" style={{ padding: '14px' }}>
                      <Link to={bPath(`/product/${rel.id}`)}>
                        <h4 className="product-title" style={{ fontSize: '15px' }}>{rel.name}</h4>
                      </Link>
                      <div className="product-bottom-row" style={{ marginTop: '10px' }}>
                        <span className="product-price" style={{ fontSize: '16px' }}>{formatCurrency(relPrice, currency)}</span>
                        <button
                          className="btn btn-primary btn-sm btn-pill"
                          onClick={() => addItem(rel, { name: 'Standard', selling_price: relPrice }, 1)}
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;
