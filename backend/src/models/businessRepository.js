const db = require('../config/db');

// In-memory tenant store fallback for testing and offline environments
const memoryBusinesses = [
  {
    id: 1,
    name: 'Crumb & Co.',
    slug: 'crumbandco',
    logo_url: '/assets/logos/crumbandco.svg',
    primary_color: '#5A3825',
    secondary_color: '#8B5A2B',
    accent_color: '#D96C8A',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    contact_email: 'order@crumbandco.in',
    contact_phone: '+91 98765 43210',
    address_line1: 'Flat 402, Sea Breeze, Carter Road, Bandra West',
    city: 'Mumbai',
    postal_code: '400050',
    state: 'Maharashtra',
    country: 'India',
    fssai_license: '12245087001234',
    upi_vpa: 'crumbandco@hdfcbank',
    is_active: true,
  },
  {
    id: 2,
    name: 'The French Loaf Bakery',
    slug: 'frenchloaf',
    logo_url: '/assets/logos/frenchloaf.svg',
    primary_color: '#1E3A8A',
    secondary_color: '#2563EB',
    accent_color: '#F59E0B',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    contact_email: 'contact@frenchloaf.com',
    contact_phone: '+91 98111 22334',
    address_line1: '15 Brigade Road, Ashok Nagar',
    city: 'Bengaluru',
    postal_code: '560025',
    state: 'Karnataka',
    country: 'India',
    fssai_license: '11223344556677',
    upi_vpa: 'frenchloaf@icici',
    is_active: true,
  },
];

class BusinessRepository {
  async findById(id) {
    try {
      const res = await db.query('SELECT * FROM businesses WHERE id = $1 AND is_active = true', [id]);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async findBySlug(slug) {
    if (!slug) return null;
    const normalized = slug.toLowerCase().trim();
    try {
      const res = await db.query('SELECT * FROM businesses WHERE LOWER(slug) = $1 AND is_active = true', [normalized]);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async updateBusiness(id, data = {}) {
    const {
      name,
      logo_url,
      primary_color,
      secondary_color,
      accent_color,
      contact_email,
      contact_phone,
      address_line1,
      city,
      postal_code,
      fssai_license,
      upi_vpa,
      upi_qr_image,
      tagline,
    } = data;

    try {
      const current = await this.findById(id);
      if (!current) throw new Error('Business not found');

      const updatedName = name !== undefined ? name : current.name;
      const updatedLogo = logo_url !== undefined ? logo_url : current.logo_url;
      const updatedPrimary = primary_color !== undefined ? primary_color : current.primary_color;
      const updatedSecondary = secondary_color !== undefined ? secondary_color : current.secondary_color;
      const updatedAccent = accent_color !== undefined ? accent_color : current.accent_color;
      const updatedEmail = contact_email !== undefined ? contact_email : current.contact_email;
      const updatedPhone = contact_phone !== undefined ? contact_phone : current.contact_phone;
      const updatedAddr = address_line1 !== undefined ? address_line1 : current.address_line1;
      const updatedCity = city !== undefined ? city : current.city;
      const updatedPin = postal_code !== undefined ? postal_code : current.postal_code;
      const updatedFssai = fssai_license !== undefined ? fssai_license : current.fssai_license;
      const updatedUpi = upi_vpa !== undefined ? upi_vpa : current.upi_vpa;
      const updatedQr = upi_qr_image !== undefined ? upi_qr_image : (current.upi_qr_image || null);
      const updatedTagline = tagline !== undefined ? tagline : (current.tagline || 'Freshly baked artisanal breads & treats');

      const res = await db.query(
        `UPDATE businesses
         SET name = $1, logo_url = $2, primary_color = $3, secondary_color = $4, accent_color = $5,
             contact_email = $6, contact_phone = $7, address_line1 = $8, city = $9, postal_code = $10,
             fssai_license = $11, upi_vpa = $12, tagline = $13, upi_qr_image = $14, updated_at = CURRENT_TIMESTAMP
         WHERE id = $15
         RETURNING *`,
        [
          updatedName,
          updatedLogo,
          updatedPrimary,
          updatedSecondary,
          updatedAccent,
          updatedEmail,
          updatedPhone,
          updatedAddr,
          updatedCity,
          updatedPin,
          updatedFssai,
          updatedUpi,
          updatedTagline,
          updatedQr,
          id,
        ]
      );
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  // Helper for test fixtures
  _addTestBusiness(business) {
    memoryBusinesses.push(business);
  }
}

module.exports = new BusinessRepository();
