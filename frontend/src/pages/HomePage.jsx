import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Clock, ShieldCheck, HeartHandshake, QrCode, AlertCircle, RefreshCw } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useBusiness } from '../context/BusinessContext';
import { getProducts, getCategories } from '../services/customerService';
import { formatCurrency } from '../utils/formatters';
import StarRating from '../components/common/StarRating';
import PwaInstallButton from '../components/common/PwaInstallButton';
import './HomePage.css';

const DEFAULT_CATEGORY_IMAGES = {
  breads: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80',
  pastries: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80',
  cakes: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80',
  cookies: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80',
  savory: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&auto=format&fit=crop&q=80',
};

const HomePage = () => {
  const { addItem } = useCart();
  const { name, currency, slug, businessId } = useBusiness();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  const fetchHomeData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [prodRes, catRes] = await Promise.all([
        getProducts({ isAvailable: true }),
        getCategories(),
      ]);

      if (prodRes && prodRes.success) {
        setProducts(prodRes.data || []);
      }
      if (catRes && catRes.success) {
        setCategories(catRes.data || []);
      }
    } catch (err) {
      setLoadError(err.message || 'Unable to load bakery catalog.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, [businessId, slug]);

  const bestSellers = products.slice(0, 4);

  return (
    <div className="home-page">
      {/* PWA Direct Download Banner */}
      <PwaInstallButton variant="banner" />

      {/* 1. Hero Section */}
      <section className="hero-section">
        <div className="container hero-inner">
          <div className="hero-content">
            <span className="hero-badge">
              <Sparkles size={14} /> Authentic & Handcrafted
            </span>
            <h1 className="hero-title font-serif">
              Freshly Baked, Delivered <br />
              <span className="hero-title-accent">with Love</span>
            </h1>
            <p className="hero-description">
              {name
                ? `Smart, warm, and handcrafted Indian bakery experience at ${name}. Freshness in every single bite, straight from our traditional clay and deck ovens to your home.`
                : 'Smart, warm, and handcrafted Indian bakery experience. Freshness in every single bite, straight from our traditional clay and deck ovens to your home.'}
            </p>
            <div className="hero-actions">
              <Link to={bPath('/menu')} className="btn btn-primary btn-pill">
                Order Now
              </Link>
              <Link to={bPath('/menu')} className="btn btn-secondary btn-pill">
                View Menu
              </Link>
              <PwaInstallButton variant="pill" />
            </div>
          </div>
          <div className="hero-image-wrap">
            <img
              src="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&auto=format&fit=crop&q=80"
              alt="Freshly baked artisan bread"
              className="hero-image"
            />
          </div>
        </div>
      </section>

      {/* 2. Why Customers Love Crumb&Co. Feature Band (#F5EDE4 from Figma) */}
      <section className="features-band">
        <div className="container">
          <div className="features-band-header">
            <h2 className="font-serif features-band-title">Why Customers Love {name || 'Crumb&Co.'}</h2>
            <p className="features-band-subtitle">Our commitment to authentic ingredients and artisanal warmth</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3 className="feature-title">Fresh Daily</h3>
              <p className="feature-desc">Baked fresh every morning in our deck ovens with zero preservatives.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <HeartHandshake size={24} />
              </div>
              <h3 className="feature-title">Quick Delivery</h3>
              <p className="feature-desc">Warm bakes delivered to your doorstep in 30-45 minutes.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <ShieldCheck size={24} />
              </div>
              <h3 className="feature-title">Custom Orders</h3>
              <p className="feature-desc">Handcrafted celebration cakes and bulk corporate orders prepared to perfection.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <QrCode size={24} />
              </div>
              <h3 className="feature-title">QR Order</h3>
              <p className="feature-desc">Seamless contactless ordering straight from your bakery table or counter.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Explore Our Categories */}
      <section className="section categories-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title font-serif">Explore Our Categories</h2>
            <p className="section-subtitle">Crafted with traditional technique and wholesome ingredients</p>
          </div>

          {categories.length > 0 ? (
            <div className="categories-grid">
              {categories.map((cat) => {
                const imgKey = Object.keys(DEFAULT_CATEGORY_IMAGES).find((k) =>
                  cat.slug.toLowerCase().includes(k)
                );
                const catImg = DEFAULT_CATEGORY_IMAGES[imgKey] || DEFAULT_CATEGORY_IMAGES.default;

                return (
                  <Link
                    key={cat.id}
                    to={bPath(`/menu?category=${cat.id}`)}
                    className="category-card"
                  >
                    <div className="category-img-wrap">
                      <img src={catImg} alt={cat.name} className="category-image" />
                    </div>
                    <div className="category-info">
                      <h3 className="category-title">{cat.name}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No categories listed currently.
            </div>
          )}
        </div>
      </section>

      {/* 4. Cake of the Day Promo Banner matching Figma */}
      <section className="promo-section container">
        <div className="promo-banner">
          <div className="promo-content">
            <span className="promo-tag">Cake of the Day</span>
            <h2 className="promo-title font-serif">Order a Freshly Baked Cake for Any Occasion</h2>
            <p className="promo-text">
              Sink into layers of velvety chocolate truffle, royal mawa, or light seasonal fruit gateaux. Handcrafted fresh on demand with 100% eggless options available.
            </p>
            <div className="promo-buttons">
              <Link to={bPath('/menu?category=cakes')} className="btn btn-primary btn-pill">
                Order a Cake
              </Link>
              <Link to={bPath('/menu')} className="btn btn-secondary btn-pill">
                View Cakes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Our Signature Best Sellers Section */}
      <section className="section best-sellers-section">
        <div className="container">
          <div className="section-header-row">
            <div>
              <h2 className="section-title font-serif">Our Signature Best Sellers</h2>
              <p className="section-subtitle">Customer favorites made fresh daily</p>
            </div>
            <Link to={bPath('/menu')} className="view-all-link">
              View Full Menu <ArrowRight size={16} />
            </Link>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="product-grid">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="card" style={{ padding: '20px', minHeight: '280px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '160px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: 'var(--radius-md)' }} />
                  <div style={{ height: '20px', width: '60%', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '4px' }} />
                  <div style={{ height: '14px', width: '40%', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!isLoading && loadError && (
            <div className="card" style={{ padding: '36px', textAlign: 'center' }}>
              <AlertCircle size={36} color="var(--color-error, #D32F2F)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{loadError}</p>
              <button onClick={fetchHomeData} className="btn btn-secondary btn-sm btn-pill">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !loadError && bestSellers.length === 0 && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No bakes currently available for {name || 'this bakery'}. Check back soon!
            </div>
          )}

          {/* Product Grid matching Figma: veg dot, star rating, full-width pink Add to Cart */}
          {!isLoading && !loadError && bestSellers.length > 0 && (
            <div className="product-grid">
              {bestSellers.map((product) => {
                const price = Number(product.base_price) || Number(product.price) || 0;
                const isVeg = product.is_eggless || product.is_veg !== false;

                return (
                  <div key={product.id} className="card product-card">
                    <Link to={bPath(`/product/${product.id}`)} className="product-image-link">
                      <div className="product-image-container">
                        <img
                          src={product.image_url || product.image || DEFAULT_CATEGORY_IMAGES.default}
                          alt={product.name}
                          className="product-image"
                        />
                        <div className="product-badge-wrap">
                          <span className={isVeg ? 'dietary-icon-veg' : 'dietary-icon-nonveg'} title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'} />
                        </div>
                        <div className="rating-wrap">
                          <StarRating rating={product.rating || 4.8} showScore={true} />
                        </div>
                      </div>
                    </Link>
                    <div className="product-info">
                      <Link to={bPath(`/product/${product.id}`)}>
                        <h3 className="product-title">{product.name}</h3>
                      </Link>
                      <p className="product-desc">{product.description}</p>
                      <div className="product-bottom-row">
                        <span className="product-price">{formatCurrency(price, currency)}</span>
                        <button
                          className="btn btn-primary btn-sm btn-pill"
                          onClick={() => addItem(product, { name: 'Standard', selling_price: price }, 1)}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
