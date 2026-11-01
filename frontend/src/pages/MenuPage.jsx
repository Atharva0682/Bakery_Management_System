import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Plus, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useBusiness } from '../context/BusinessContext';
import { useQr } from '../context/QrContext';
import { getCategories, getProducts } from '../services/customerService';
import { formatCurrency } from '../utils/formatters';
import StarRating from '../components/common/StarRating';

const MenuPage = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { businessId, slug, name, currency } = useBusiness();
  const { locationTag } = useQr();
  const [searchParams, setSearchParams] = useSearchParams();
  const tableParam = searchParams.get('table');
  const activeTable = locationTag || tableParam;

  const { addItem } = useCart();

  const [sortBy, setSortBy] = useState('popular');

  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  // Sync category query param on initial mount
  useEffect(() => {
    const catQuery = searchParams.get('category');
    if (catQuery) {
      setActiveCategory(catQuery);
    }
  }, [searchParams]);

  // 1. Fetch categories for active business
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const res = await getCategories();
        if (isMounted && res && res.success && Array.isArray(res.data)) {
          setCategories(res.data);
        }
      } catch (err) {
        console.warn('Could not fetch categories for business', err);
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, [businessId, slug]);

  // 2. Fetch products for active business with category & search filter
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (activeCategory !== 'All') {
        params.categoryId = activeCategory;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await getProducts(params);
      if (res && res.success && Array.isArray(res.data)) {
        let items = [...res.data];
        if (sortBy === 'price_asc') {
          items.sort((a, b) => (Number(a.base_price) || 0) - (Number(b.base_price) || 0));
        } else if (sortBy === 'price_desc') {
          items.sort((a, b) => (Number(b.base_price) || 0) - (Number(a.base_price) || 0));
        } else if (sortBy === 'rating') {
          items.sort((a, b) => (Number(b.rating) || 4.8) - (Number(a.rating) || 4.8));
        }
        setProducts(items);
      } else {
        setProducts([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load menu products.');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, searchQuery, sortBy, businessId, slug]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCategoryClick = (catId) => {
    setActiveCategory(catId);
    if (catId === 'All') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', catId);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="menu-page" style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Table / Location Banner if customer entered via QR */}
        {activeTable && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(216, 109, 139, 0.08)',
              color: 'var(--color-brand-primary)',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md, 12px)',
              marginBottom: '24px',
              border: '1px solid rgba(216, 109, 139, 0.2)',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <MapPin size={18} />
            <span>Ordering for: <strong>{activeTable}</strong></span>
          </div>
        )}

        {/* Menu Title & Search Header matching Figma */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="font-serif" style={{ fontSize: '36px', color: 'var(--text-primary)', margin: 0 }}>
                {name ? `${name} Menu` : 'Our Artisanal Menu'}
              </h1>
              <span
                style={{
                  backgroundColor: 'var(--color-brand-primary-light, #FDF2F4)',
                  color: 'var(--color-brand-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(216, 109, 139, 0.25)',
                }}
              >
                {products.length} items
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '4px' }}>
              Freshly baked artisanal breads, celebratory cakes, and savoury bites
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search Truffle, Croissant, Puff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '10px 16px 10px 40px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'var(--bg-surface)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  width: '260px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Sort by dropdown matching Figma */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '9999px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'var(--bg-surface)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="popular">Sort by: Popular</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '32px' }}>
          <button
            onClick={() => handleCategoryClick('All')}
            className="btn btn-pill"
            style={{
              backgroundColor: activeCategory === 'All' ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
              color: activeCategory === 'All' ? '#FFFFFF' : 'var(--text-secondary)',
              border: `1px solid ${activeCategory === 'All' ? 'var(--color-brand-primary)' : 'var(--border-light)'}`,
              padding: '8px 18px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            All Items
          </button>
          {categories.map((cat) => {
            const isSelected = String(activeCategory) === String(cat.id) || String(activeCategory) === String(cat.slug);
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(String(cat.id))}
                className="btn btn-pill"
                style={{
                  backgroundColor: isSelected ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--border-light)'}`,
                  padding: '8px 18px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Loading State: Skeleton Cards matching Figma 3-column layout */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '28px' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card" style={{ height: '360px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '200px', backgroundColor: 'var(--bg-surface-soft)' }} />
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ height: '20px', width: '70%', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '4px' }} />
                  <div style={{ height: '14px', width: '90%', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '4px' }} />
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ height: '24px', width: '60px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '4px' }} />
                    <div style={{ height: '32px', width: '80px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '9999px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <AlertCircle size={40} color="var(--color-error, #D32F2F)" style={{ margin: '0 auto 16px' }} />
            <h2 className="font-serif" style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              Could Not Load Products
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{error}</p>
            <button onClick={fetchProducts} className="btn btn-primary btn-pill">
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && products.length === 0 && (
          <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🥐</span>
            <h2 className="font-serif" style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-primary)' }}>
              No Bakes Found
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '24px', maxWidth: '420px', margin: '0 auto 24px' }}>
              We couldn't find any items matching your filter in {name || 'this bakery'}'s catalog.
            </p>
            <button
              onClick={() => {
                setActiveCategory('All');
                setSearchQuery('');
                searchParams.delete('category');
                setSearchParams(searchParams);
              }}
              className="btn btn-secondary btn-pill"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Product Cards Grid matching Figma 3-column layout */}
        {!isLoading && !error && products.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '28px' }}>
            {products.map((product) => {
              const price = Number(product.base_price) || 0;
              const isAvailable = product.is_available !== false;
              const isVeg = product.is_eggless || product.is_veg !== false;

              return (
                <div key={product.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
                  <Link to={bPath(`/product/${product.id}`)} style={{ textDecoration: 'none' }}>
                    <div style={{ position: 'relative', height: '200px' }}>
                      <img
                        src={product.image_url || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500'}
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Dietary Veg/Non-Veg Badge */}
                      <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
                        <span className={isVeg ? 'dietary-icon-veg' : 'dietary-icon-nonveg'} title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'} />
                      </div>
                      <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(255,255,255,0.95)', padding: '2px 8px', borderRadius: '9999px', backdropFilter: 'blur(4px)' }}>
                        <StarRating rating={product.rating || 4.8} showScore={true} />
                      </div>
                      {!isAvailable && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '12px',
                            left: '12px',
                            backgroundColor: 'rgba(211, 47, 47, 0.9)',
                            color: '#FFF',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Sold Out
                        </div>
                      )}
                    </div>
                  </Link>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Link to={bPath(`/product/${product.id}`)} style={{ textDecoration: 'none' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                        {product.name}
                      </h3>
                    </Link>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', flex: 1 }}>
                      {product.description}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(price, currency)}
                      </span>
                      {isAvailable ? (
                        <button
                          className="btn btn-primary btn-sm btn-pill"
                          onClick={() => addItem(product, { name: 'Standard', selling_price: price }, 1)}
                        >
                          <Plus size={16} /> Add
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-pill"
                          disabled
                          style={{ backgroundColor: 'var(--bg-surface-soft)', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                        >
                          Unavailable
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuPage;
