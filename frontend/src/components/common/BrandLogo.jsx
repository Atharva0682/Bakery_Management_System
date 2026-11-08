import React, { useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';

/**
 * White-labelable Bakery Brand Logo Component
 * - Displays uploaded tenant logo if configured (white-labeled)
 * - Automatically falls back to the artisanal Crumb & Co. emblem SVG
 * - Replaces generic crowns and placeholder initials across Customer, Owner, and Worker interfaces
 */
export default function BrandLogo({
  src,
  alt,
  size = 36,
  rounded = 10,
  className = '',
  style = {},
  showName = false,
  subtitle = null,
  linkTo = null
}) {
  const businessContext = useBusiness?.();
  const business = businessContext?.business;
  const businessLogo = src || businessContext?.logo || business?.logo_url || business?.logoUrl || business?.branding?.logoUrl;
  const businessName = alt || businessContext?.name || business?.name || 'Crumb & Co.';

  const [imgError, setImgError] = useState(false);

  // Default artisanal Crumb & Co. emblem
  const fallbackSvg = '/assets/logos/crumbandco.svg';
  const effectiveSrc = (!imgError && businessLogo) ? businessLogo : fallbackSvg;

  const logoNode = (
    <div
      className={`brand-logo-container ${className}`}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
        borderRadius: typeof rounded === 'number' ? `${rounded}px` : rounded,
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 6px rgba(90, 56, 37, 0.12)',
        border: '1px solid rgba(232, 224, 215, 0.9)',
        ...style
      }}
    >
      <img
        src={effectiveSrc}
        alt={businessName}
        onError={() => setImgError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );

  if (!showName && !subtitle) {
    return logoNode;
  }

  const content = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      {logoNode}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span
          style={{
            fontFamily: "var(--ow-serif, 'Playfair Display', Georgia, serif)",
            fontWeight: 700,
            fontSize: size >= 36 ? '16px' : '14px',
            color: 'var(--ow-ink, #3B2B20)',
            letterSpacing: '-0.2px'
          }}
        >
          {businessName}
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--ow-accent, #A85F2C)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              marginTop: '2px'
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  return content;
}
