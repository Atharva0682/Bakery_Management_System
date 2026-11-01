const db = require('../config/db');

// In-memory fallback dataset for QR codes matching migration 001_multi_tenant_migration.sql
const memoryQrCodes = [
  {
    id: 1,
    business_id: 1,
    qr_type: 'table_order',
    unique_code: 'QR-CRUMB-TBL-01',
    target_url: '/b/crumbandco?table=1',
    location_tag: 'Table 1 (Indoor)',
    is_active: true,
    scan_count: 5,
  },
  {
    id: 2,
    business_id: 1,
    qr_type: 'direct_payment',
    unique_code: 'QR-CRUMB-PAY-COUNTER',
    target_url: '/b/crumbandco/checkout',
    location_tag: 'Main Cashier Counter',
    is_active: true,
    scan_count: 12,
  },
  {
    id: 3,
    business_id: 2,
    qr_type: 'table_order',
    unique_code: 'QR-FL-TBL-01',
    target_url: '/b/frenchloaf?table=1',
    location_tag: 'Garden Table 1',
    is_active: true,
    scan_count: 3,
  },
  {
    id: 4,
    business_id: 2,
    qr_type: 'counter_pickup',
    unique_code: 'QR-FL-PICKUP-01',
    target_url: '/b/frenchloaf/menu',
    location_tag: 'Express Pickup Kiosk',
    is_active: true,
    scan_count: 8,
  },
  {
    id: 5,
    business_id: 1,
    qr_type: 'table_order',
    unique_code: 'QR-CRUMB-INACTIVE',
    target_url: '/b/crumbandco?table=99',
    location_tag: 'Decommissioned Table 99',
    is_active: false,
    scan_count: 0,
  },
];

class QrRepository {
  async findByCode(uniqueCode) {
    if (!uniqueCode) return null;
    const normalized = uniqueCode.trim();
    try {
      const res = await db.query('SELECT * FROM qr_codes WHERE unique_code = $1', [normalized]);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async incrementScanCount(id) {
    try {
      await db.query('UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = $1', [id]);
    } catch (err) {

      throw err;
    }
  }

  _addTestQr(qr) {
    memoryQrCodes.push(qr);
  }
}

module.exports = new QrRepository();
