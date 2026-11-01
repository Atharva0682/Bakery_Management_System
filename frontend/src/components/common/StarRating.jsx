import React from 'react';
import { Star } from 'lucide-react';

const StarRating = ({ rating = 5, totalReviews = null, size = 16, showScore = true }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <Star size={size} fill="#F59E0B" color="#F59E0B" />
      {showScore && (
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {Number(rating).toFixed(1)}
        </span>
      )}
      {totalReviews && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          ({totalReviews})
        </span>
      )}
    </div>
  );
};

export default StarRating;
