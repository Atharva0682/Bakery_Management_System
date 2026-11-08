import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { BRAND } from '../../utils/constants';
import BrandLogo from './BrandLogo';
import './Footer.css';

const Footer = () => {
  const { name, contact, address, business, slug } = useBusiness();

  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  const displayName = name || BRAND.name;
  const brandInitial = displayName ? displayName.trim().charAt(0).toUpperCase() : 'C';
  const displayPhone = contact?.phone || business?.contact_phone || BRAND.phone;
  const displayEmail = contact?.email || business?.contact_email || BRAND.email;
  const displayAddress = address?.line1
    ? `${address.line1}, ${address.city || ''} ${address.postalCode || ''}`.trim()
    : BRAND.address;
  const displayFssai = business?.fssaiLicense || business?.fssai_license || BRAND.fssai;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-content">
        {/* Brand Story Column */}
        <div className="footer-col brand-col">
          <Link to={bPath('/')} className="footer-logo">
            <BrandLogo size={28} rounded={6} />
            <span className="footer-brand-name">
              {displayName}
            </span>
          </Link>
          <p className="footer-desc">
            {business?.description || BRAND.description}
          </p>
        </div>

        {/* Explore Links Column */}
        <div className="footer-col">
          <h4 className="footer-heading">Explore</h4>
          <ul className="footer-links">
            <li>
              <Link to={bPath('/menu')}>Our Menu</Link>
            </li>
            <li>
              <Link to={bPath('/menu?category=cakes')}>Occasion Cakes</Link>
            </li>
            <li>
              <Link to={bPath('/menu?category=savory')}>Bulk Orders</Link>
            </li>
            <li>
              <Link to={bPath('/orders')}>Track Your Order</Link>
            </li>
            <li>
              <Link to="/staff/login" style={{ fontWeight: 600 }}>👨‍🍳 Staff Floor Login</Link>
            </li>
            <li>
              <Link to="/owner/login" style={{ fontWeight: 600 }}>Owner Operations Login</Link>
            </li>
          </ul>
        </div>

        {/* Contact Us Column */}
        <div className="footer-col contact-col">
          <h4 className="footer-heading">Contact Us</h4>
          <ul className="footer-contact-list">
            <li>
              <Phone size={16} className="contact-icon" />
              <span>{displayPhone}</span>
            </li>
            <li>
              <Mail size={16} className="contact-icon" />
              <a href={`mailto:${displayEmail}`}>{displayEmail}</a>
            </li>
            <li>
              <MapPin size={16} className="contact-icon" />
              <span>{displayAddress}</span>
            </li>
            <li className="fssai-row">
              <ShieldCheck size={16} className="contact-icon fssai-icon" />
              <span>FSSAI Lic No. {displayFssai}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>© {currentYear} {displayName}. All rights reserved.</p>
          <p className="footer-tagline">Authentic & Handcrafted with Passion</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
