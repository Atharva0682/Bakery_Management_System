const qrRepository = require('../models/qrRepository');
const businessRepository = require('../models/businessRepository');

const VALID_QR_TYPES = ['table_order', 'counter_pickup', 'direct_payment', 'digital_menu', 'custom'];

class QrService {
  async resolveQr(uniqueCode) {
    if (!uniqueCode) {
      const err = new Error('QR code is required.');
      err.code = 'QR_CODE_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    const qr = await qrRepository.findByCode(uniqueCode);
    if (!qr) {
      const err = new Error(`QR code '${uniqueCode}' not found.`);
      err.code = 'QR_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (!qr.is_active) {
      const err = new Error(`QR code '${uniqueCode}' has been deactivated.`);
      err.code = 'QR_INACTIVE';
      err.statusCode = 400;
      throw err;
    }

    if (!VALID_QR_TYPES.includes(qr.qr_type)) {
      const err = new Error(`Invalid QR code type '${qr.qr_type}'.`);
      err.code = 'INVALID_QR_TYPE';
      err.statusCode = 400;
      throw err;
    }

    const business = await businessRepository.findById(qr.business_id);
    if (!business || !business.is_active) {
      const err = new Error(`Business associated with QR code '${uniqueCode}' is not available.`);
      err.code = 'BUSINESS_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Increment scan count in background/repository
    await qrRepository.incrementScanCount(qr.id);

    return {
      uniqueCode: qr.unique_code,
      qrType: qr.qr_type,
      locationTag: qr.location_tag || null,
      targetUrl: qr.target_url,
      isActive: Boolean(qr.is_active),
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        logoUrl: business.logo_url || null,
        branding: {
          primaryColor: business.primary_color || '#5A3825',
          secondaryColor: business.secondary_color || '#8B5A2B',
          accentColor: business.accent_color || '#D96C8A',
        },
        currency: business.currency || 'INR',
        currencySymbol: business.currency_symbol || '₹',
        timezone: business.timezone || 'Asia/Kolkata',
      },
    };
  }
}

module.exports = new QrService();
