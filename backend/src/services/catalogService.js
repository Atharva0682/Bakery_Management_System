const businessRepository = require('../models/businessRepository');
const catalogRepository = require('../models/catalogRepository');

class CatalogService {
  /**
   * Return safe public business profile by slug (never exposes secrets or owner hashes)
   */
  async getPublicBusiness(slug) {
    if (!slug) {
      const err = new Error('Business slug is required.');
      err.code = 'SLUG_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    const business = await businessRepository.findBySlug(slug);
    if (!business || !business.is_active) {
      const err = new Error(`Bakery business '${slug}' not found or inactive.`);
      err.code = 'BUSINESS_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logoUrl: business.logo_url || null,
      branding: {
        primaryColor: business.primary_color || '#5A3825',
        secondaryColor: business.secondary_color || '#8B5A2B',
        accentColor: business.accent_color || '#D96C8A',
      },
      pricing: { delivery_fee: Number(business.delivery_fee), free_delivery_threshold: Number(business.free_delivery_threshold), delivery_gst_rate: Number(business.delivery_gst_rate) },
      currency: business.currency || 'INR',
      timezone: business.timezone || 'Asia/Kolkata',
      contact: {
        email: business.contact_email,
        phone: business.contact_phone,
      },
      address: {
        line1: business.address_line1,
        line2: business.address_line2 || null,
        city: business.city,
        postalCode: business.postal_code,
        state: business.state || null,
        country: business.country || 'India',
      },
      fssaiLicense: business.fssai_license || null,
      fssai_license: business.fssai_license || null,
      upiVpa: business.upi_vpa || null,
      upi_vpa: business.upi_vpa || null,
      upi_qr_image: business.upi_qr_image || null,
      upiQrImage: business.upi_qr_image || null,
      tagline: business.tagline || 'Artisanal Deck Oven Bakery & Fine Patisserie',
      isActive: Boolean(business.is_active),
    };
  }

  async getCategories(businessId) {
    if (!businessId) {
      const err = new Error('Business identifier is required.');
      err.code = 'BUSINESS_REQUIRED';
      err.statusCode = 400;
      throw err;
    }
    return catalogRepository.getCategories(businessId);
  }

  async getProducts({ businessId, categoryId, search, isAvailable = null }) {
    if (!businessId) {
      const err = new Error('Business identifier is required.');
      err.code = 'BUSINESS_REQUIRED';
      err.statusCode = 400;
      throw err;
    }
    return catalogRepository.getProducts({ businessId, categoryId, isAvailable, search });
  }

  async getProductDetails(productId, businessId) {
    const product = await catalogRepository.getProductById(productId, businessId);
    if (!product) {
      const err = new Error('Product not found in this bakery catalog.');
      err.code = 'PRODUCT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const variants = await catalogRepository.getVariantsByProductId(product.id);
    return {
      ...product,
      variants,
    };
  }
}

module.exports = new CatalogService();
