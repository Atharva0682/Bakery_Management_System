import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Star,
  Upload,
  Award,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  ShoppingBag,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import customerService from '../services/customerService';
import { formatCurrency, formatDate } from '../utils/formatters';

const TAGS = [
  'Fresh',
  'Warm',
  'Authentic',
  'On Time',
  'Moist',
  'Balanced',
  'Crispy',
  'Rich Flavor',
];

const COMPLAINT_CATEGORIES = [
  'Product Quality',
  'Order Issue',
  'Payment Issue',
  'Delivery Issue',
  'Complaint',
  'General Feedback',
];

const FeedbackPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuth();
  const { slug, currency, name: businessName } = useBusiness();

  // Active Order state
  const [order, setOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(Boolean(orderId));
  const [orderError, setOrderError] = useState(null);

  // Past Reviews state
  const [pastReviews, setPastReviews] = useState([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  // Form ratings state
  const [ratings, setRatings] = useState({
    overall: 5,
    taste: 5,
    freshness: 5,
    delivery: 5,
  });
  const [bakedAsExpected, setBakedAsExpected] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('General Feedback');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedTags, setSelectedTags] = useState(['Fresh', 'Warm']);
  const [comment, setComment] = useState('');

  // Submission UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  // Helper for tenant-scoped routes
  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  // 1. Fetch Order details if orderId is provided
  useEffect(() => {
    let isMounted = true;
    if (!orderId) {
      setIsLoadingOrder(false);
      return;
    }

    const fetchOrder = async () => {
      setIsLoadingOrder(true);
      setOrderError(null);
      try {
        const res = await customerService.getOrderById(orderId);
        if (isMounted && res.success && res.data) {
          setOrder(res.data);
          // If order is cancelled, set warning
          if (res.data.order_status === 'Cancelled') {
            setOrderError('Cancelled orders are not eligible for review or feedback.');
          }
        } else {
          throw new Error('Order not found.');
        }
      } catch (err) {
        if (isMounted) {
          setOrderError(err.message || 'Unable to load order details.');
        }
      } finally {
        if (isMounted) setIsLoadingOrder(false);
      }
    };

    fetchOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // 2. Fetch Customer's Past Reviews
  const fetchPastReviews = async () => {
    setIsLoadingReviews(true);
    try {
      const res = await customerService.getMyFeedback();
      if (res.success && res.data) {
        setPastReviews(res.data);
        // Check if current order was already reviewed
        if (orderId && res.data.some((fb) => Number(fb.order_id) === Number(orderId) || String(fb.order_no) === String(orderId))) {
          setAlreadyReviewed(true);
        }
      }
    } catch (err) {
      console.warn('Could not load past feedback:', err.message);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPastReviews();
    } else {
      setIsLoadingReviews(false);
    }
  }, [isAuthenticated, orderId]);

  // Handle tag toggle
  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Handle criteria rating
  const handleRatingChange = (categoryKey, value) => {
    setRatings((prev) => ({ ...prev, [categoryKey]: value }));
  };

  // Handle Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!orderId && !order) {
      setErrorMessage('Please specify a valid order to review.');
      return;
    }

    if (ratings.overall < 1 || ratings.overall > 5) {
      setErrorMessage('Please select a star rating from 1 to 5.');
      return;
    }

    const isComplaint = !bakedAsExpected || ratings.overall <= 2 || selectedCategory !== 'General Feedback';

    if (isComplaint && (!comment || comment.trim().length < 5)) {
      setErrorMessage('Please provide a brief explanation describing the issue so our bakers can investigate.');
      return;
    }

    if (comment && comment.length > 1000) {
      setErrorMessage('Comment cannot exceed 1000 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        order_id: order?.id || orderId,
        product_id: selectedProductId ? Number(selectedProductId) : undefined,
        rating_overall: ratings.overall,
        rating_taste: ratings.taste,
        rating_freshness: ratings.freshness,
        rating_delivery: ratings.delivery,
        comment: comment.trim() || undefined,
        tags: selectedTags,
        bakedAsExpected,
        category: isComplaint ? selectedCategory : 'General Feedback',
        is_complaint: isComplaint,
      };

      const res = await customerService.submitOrderFeedback(payload);

      if (res.success && res.data) {
        setIsSubmitted(true);
        setSubmittedFeedback(res.data.feedback || res.data);
        // Refresh points in auth context
        if (user?.crumbPoints) {
          updateUser({ crumbPoints: user.crumbPoints + 50 });
        }
        // Refresh past reviews
        fetchPastReviews();
      } else {
        throw new Error(res.message || 'Server rejected feedback.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Unable to submit feedback.';
      if (err.response?.data?.code === 'FEEDBACK_EXISTS') {
        setAlreadyReviewed(true);
      }
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const crumbBalance = (user?.crumbPoints || 1240) + (isSubmitted ? 50 : 0);

  return (
    <div style={{ backgroundColor: 'var(--bg-canvas)', minHeight: 'calc(100vh - var(--header-height))', padding: '36px 0 80px' }}>
      <div className="container" style={{ maxWidth: '1080px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
          <Link to={bPath('/')} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Home
          </Link>
          <ChevronRight size={14} />
          <Link to={bPath('/orders')} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Orders
          </Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>Feedback & Reviews</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '36px', alignItems: 'start' }}>
          {/* LEFT COLUMN: REVIEW / COMPLAINT FORM */}
          <div className="card" style={{ padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
            <h1 className="font-serif" style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Share Your Experience
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Your valuable feedback helps us perfect our master recipes and delivery standards daily.
            </p>

            {/* Loading Order Indicator */}
            {isLoadingOrder && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                Fetching order details...
              </div>
            )}

            {/* Order Error / Ineligible Alert */}
            {orderError && (
              <div
                style={{
                  backgroundColor: '#FFEBEE',
                  color: '#C62828',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '14px',
                  border: '1px solid #FFCDD2',
                }}
              >
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Order Not Eligible:</strong> {orderError}
                  <div style={{ marginTop: '6px' }}>
                    <Link to={bPath('/orders')} style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>
                      ← Select another order from My Orders
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Active Order Context Banner */}
            {order && !orderError && (
              <div
                style={{
                  backgroundColor: '#FDF7F2',
                  border: '1px solid #EAD8C7',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  marginBottom: '28px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
                    Reviewing Order #{order.order_no || order.id}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: 'rgba(90, 56, 37, 0.1)',
                      color: 'var(--color-brand-primary)',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    {order.order_status}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {order.items && order.items.length > 0
                    ? order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')
                    : 'Artisan Bakery Selection'}
                  {order.total_amount && ` • Total: ${formatCurrency(order.total_amount, currency)}`}
                </div>
              </div>
            )}

            {/* Already Reviewed Alert */}
            {alreadyReviewed && !isSubmitted && (
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  color: '#1E40AF',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '14px',
                  border: '1px solid #BFDBFE',
                }}
              >
                <CheckCircle size={20} color="#2563EB" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Already Reviewed:</strong> You have already submitted feedback for this order. Check your review in the list on the right.
                </div>
              </div>
            )}

            {/* Form Error Banner */}
            {errorMessage && (
              <div
                style={{
                  backgroundColor: '#FFEBEE',
                  color: '#C62828',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  border: '1px solid #FFCDD2',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SUCCESS STATE */}
            {isSubmitted ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    backgroundColor: '#E8F5E9',
                    color: '#2E7D32',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}
                >
                  <CheckCircle size={40} />
                </div>
                <h3 className="font-serif" style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Feedback Submitted!
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '440px', margin: '0 auto 20px' }}>
                  Thank you! Your feedback has been recorded and <strong>50 Crumb Points</strong> have been credited to your account.
                </p>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#FEF3C7',
                    color: '#92400E',
                    padding: '8px 20px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    fontSize: '14px',
                    marginBottom: '28px',
                  }}
                >
                  <Sparkles size={16} />
                  New Balance: {crumbBalance} Crumb Points
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <Link to={bPath('/orders')} className="btn btn-primary btn-pill">
                    Back to My Orders
                  </Link>
                  <Link to={bPath('/menu')} className="btn btn-outline btn-pill">
                    Browse Menu
                  </Link>
                </div>
              </div>
            ) : !alreadyReviewed && !orderError ? (
              /* FEEDBACK SUBMISSION FORM */
              <form onSubmit={handleSubmit}>
                {/* 4 Criteria Star Ratings matching Figma */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginBottom: '28px' }}>
                  {[
                    { key: 'overall', title: 'Overall Experience', sub: 'How was your overall ordering journey?' },
                    { key: 'taste', title: 'Taste & Flavors', sub: 'Indian spices blend and richness' },
                    { key: 'freshness', title: 'Freshness', sub: 'Softness and warmth of baked goodness' },
                    { key: 'delivery', title: 'Delivery Hand-off', sub: 'Timeliness and packaging safety' },
                  ].map((crit) => (
                    <div
                      key={crit.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        paddingBottom: '16px',
                        borderBottom: '1px solid var(--border-light)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{crit.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{crit.sub}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleRatingChange(crit.key, star)}
                            aria-label={`Rate ${crit.title} ${star} stars`}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Star
                              size={24}
                              fill={star <= ratings[crit.key] ? '#F59E0B' : '#E5D5C5'}
                              color={star <= ratings[crit.key] ? '#F59E0B' : '#E5D5C5'}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Specific Product Item Selector (if order has items) */}
                {order?.items && order.items.length > 1 && (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                      Reviewing Specific Product (Optional)
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="input"
                      style={{ width: '100%', minHeight: '44px' }}
                    >
                      <option value="">All items in this order</option>
                      {order.items.map((item) => (
                        <option key={item.id || item.product_id} value={item.product_id}>
                          {item.name} (Batch #{item.batch_id || 'Fresh'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Was everything baked as expected? (Figma requirement) */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                    Was everything baked as expected?
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setBakedAsExpected(true);
                        setSelectedCategory('General Feedback');
                      }}
                      className="btn btn-pill"
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        backgroundColor: bakedAsExpected ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                        color: bakedAsExpected ? '#FFF' : 'var(--text-primary)',
                        border: '1px solid var(--border-medium)',
                        fontWeight: 600,
                      }}
                    >
                      Yes, Perfectly Baked
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBakedAsExpected(false);
                        setSelectedCategory('Product Quality');
                      }}
                      className="btn btn-pill"
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        backgroundColor: !bakedAsExpected ? '#C62828' : 'var(--bg-surface)',
                        color: !bakedAsExpected ? '#FFF' : 'var(--text-primary)',
                        border: !bakedAsExpected ? '1px solid #C62828' : '1px solid var(--border-medium)',
                        fontWeight: 600,
                      }}
                    >
                      Could Be Better / Issue
                    </button>
                  </div>
                </div>

                {/* Issue / Complaint Category Dropdown when an issue is reported */}
                {(!bakedAsExpected || ratings.overall <= 2) && (
                  <div style={{ marginBottom: '24px', backgroundColor: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#C62828', fontWeight: 700, fontSize: '14px' }}>
                      <AlertCircle size={16} />
                      Report Complaint / Issue
                    </div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                      Issue Category *
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="input"
                      style={{ width: '100%', minHeight: '44px', backgroundColor: '#FFFFFF' }}
                    >
                      {COMPLAINT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Our head baker and support team will inspect the batch details to resolve this issue.
                    </div>
                  </div>
                )}

                {/* Comment Textarea */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Your Review Comment {!bakedAsExpected && '*'}
                    </label>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {comment.length} / 1000
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us what you loved! (e.g. The cardamom flavor in the Truffle was beautifully balanced, arrived completely hot and fresh!)"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-medium)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      resize: 'none',
                    }}
                  />
                </div>

                {/* Quick Feedback Tags matching Figma */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)' }}>
                    Quick Feedback Tags
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className="btn btn-pill btn-sm"
                          style={{
                            backgroundColor: isSelected ? 'rgba(90, 56, 37, 0.1)' : 'var(--bg-surface)',
                            color: isSelected ? 'var(--color-brand-primary)' : 'var(--text-secondary)',
                            border: `1px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--border-light)'}`,
                            fontSize: '12px',
                            minHeight: '36px',
                            fontWeight: 600,
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Crumb Points Reward Banner matching Figma */}
                <div
                  style={{
                    backgroundColor: 'var(--color-brand-primary-light, #FDF2F4)',
                    border: '1px solid rgba(216, 109, 139, 0.35)',
                    padding: '16px 20px',
                    borderRadius: '16px',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Award size={18} color="var(--color-brand-primary)" />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
                        Crumb Points Reward
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-brand-primary)', backgroundColor: '#FFFFFF', padding: '2px 10px', borderRadius: '9999px', border: '1px solid rgba(216, 109, 139, 0.3)' }}>
                      +50 Points
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '4px 0 10px' }}>
                    Complete this review to earn 50 Crumb Points. Redeem them for free treats, early access, and special bakery perks on your next order.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, borderTop: '1px dashed rgba(216, 109, 139, 0.25)', paddingTop: '8px' }}>
                    <span>Current Balance: <strong>{user?.crumbPoints || 1240} pts</strong></span>
                    <span>Next Reward: <strong style={{ color: 'var(--color-brand-primary)' }}>260 pts away</strong></span>
                  </div>
                </div>

                {/* Photo Upload Box matching Figma */}
                <div
                  style={{
                    border: '1px dashed var(--border-medium)',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    marginBottom: '28px',
                    backgroundColor: 'var(--bg-surface-soft)',
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Upload Photos (Optional)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Click to upload your bakery snaps (PNG or JPG up to 5MB)
                  </div>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary btn-pill"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '16px',
                    minHeight: '48px',
                    opacity: isSubmitting ? 0.75 : 1,
                  }}
                >
                  {isSubmitting ? 'Submitting Feedback...' : 'Submit Feedback & Earn 50 Points'}
                </button>
              </form>
            ) : null}
          </div>

          {/* RIGHT COLUMN: MY PAST REVIEWS MATCHING FIGMA */}
          <div>
            <div className="card" style={{ padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
              <h2 className="font-serif" style={{ fontSize: '22px', marginBottom: '6px', color: 'var(--text-primary)' }}>
                My Past Reviews
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Reviews and ratings you have shared for previous deliveries
              </p>

              {isLoadingReviews ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading your review history...
                </div>
              ) : pastReviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', border: '1px dashed var(--border-medium)', borderRadius: '12px' }}>
                  <MessageSquare size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    No reviews yet
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Your submitted ratings will appear here after you review your bakery orders.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {pastReviews.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        border: '1px solid var(--border-light)',
                        borderRadius: '12px',
                        padding: '16px',
                        backgroundColor: rev.is_complaint ? '#FFFDFD' : '#FDFCFB',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Order #{rev.order_no || rev.order_id}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {formatDate(rev.created_at || rev.order_date)}
                        </span>
                      </div>

                      {/* Stars & Category */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={14}
                              fill={s <= rev.rating_overall ? '#F59E0B' : '#E5D5C5'}
                              color={s <= rev.rating_overall ? '#F59E0B' : '#E5D5C5'}
                            />
                          ))}
                        </div>

                        {rev.is_complaint ? (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#C62828',
                              backgroundColor: '#FFEBEE',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                            }}
                          >
                            Complaint • {rev.status || 'Pending Review'}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#2E7D32',
                              backgroundColor: '#E8F5E9',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                            }}
                          >
                            +50 Pts
                          </span>
                        )}
                      </div>

                      {/* Comment text */}
                      {rev.comment && (
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 8px' }}>
                          "{rev.comment}"
                        </p>
                      )}

                      {/* Tags */}
                      {rev.tags && rev.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {rev.tags.map((t, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '10px',
                                backgroundColor: 'var(--bg-surface-soft)',
                                color: 'var(--text-muted)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 500,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
