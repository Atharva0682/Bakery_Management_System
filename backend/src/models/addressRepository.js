const db = require('../config/db');

const INITIAL_ADDRESSES = [
  {
    id: 1,
    business_id: 1,
    user_id: 4, // Ananya Nair
    label: 'Home (Default)',
    address_line1: 'Flat 402, Sea Breeze Apartments, Carter Road',
    address_line2: 'Near Cafe Basilico, Bandra West',
    city: 'Mumbai',
    postal_code: '400050',
    contact_phone: '+91 98201 54321',
    is_default: true,
  },
  {
    id: 2,
    business_id: 2,
    user_id: 13, // Vikram Mehta (Business 2 customer)
    label: 'Home',
    address_line1: '88 MG Road, Ashok Nagar',
    address_line2: 'Opposite Garuda Mall',
    city: 'Bengaluru',
    postal_code: '560025',
    contact_phone: '+91 98301 54322',
    is_default: true,
  },
];

let memoryAddresses = JSON.parse(JSON.stringify(INITIAL_ADDRESSES));
let nextAddressId = 10;

class AddressRepository {
  async getByUserId(userId, businessId) {
    try {
      const res = await db.query(
        'SELECT * FROM customer_addresses WHERE user_id = $1 AND business_id = $2 ORDER BY is_default DESC, id DESC',
        [userId, businessId]
      );
      return res.rows;
    } catch (err) {

      throw err;
    }
  }

  async getById(id, userId, businessId) {
    try {
      const res = await db.query(
        'SELECT * FROM customer_addresses WHERE id = $1 AND user_id = $2 AND business_id = $3',
        [id, userId, businessId]
      );
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async create({ business_id, user_id, label, address_line1, address_line2, city, postal_code, contact_phone, is_default = false }) {
    const shouldBeDefault = Boolean(is_default);

    try {
      if (shouldBeDefault) {
        await db.query(
          'UPDATE customer_addresses SET is_default = false WHERE user_id = $1 AND business_id = $2',
          [user_id, business_id]
        );
      }

      const res = await db.query(
        `INSERT INTO customer_addresses (business_id, user_id, label, address_line1, address_line2, city, postal_code, contact_phone, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [business_id, user_id, label || 'Home', address_line1, address_line2 || null, city, postal_code, contact_phone, shouldBeDefault]
      );
      return res.rows[0];
    } catch (err) {

      throw err;
    }
  }

  async update(id, userId, businessId, updates) {
    const existing = await this.getById(id, userId, businessId);
    if (!existing) return null;

    const willBeDefault = updates.is_default !== undefined ? Boolean(updates.is_default) : existing.is_default;

    try {
      if (willBeDefault) {
        await db.query(
          'UPDATE customer_addresses SET is_default = false WHERE user_id = $1 AND business_id = $2 AND id != $3',
          [userId, businessId, id]
        );
      }

      const res = await db.query(
        `UPDATE customer_addresses 
         SET label = COALESCE($1, label),
             address_line1 = COALESCE($2, address_line1),
             address_line2 = COALESCE($3, address_line2),
             city = COALESCE($4, city),
             postal_code = COALESCE($5, postal_code),
             contact_phone = COALESCE($6, contact_phone),
             is_default = COALESCE($7, is_default)
         WHERE id = $8 AND user_id = $9 AND business_id = $10 RETURNING *`,
        [
          updates.label,
          updates.address_line1,
          updates.address_line2,
          updates.city,
          updates.postal_code,
          updates.contact_phone,
          updates.is_default !== undefined ? updates.is_default : null,
          id,
          userId,
          businessId,
        ]
      );
      return res.rows[0];
    } catch (err) {

      throw err;
    }
  }

  async setDefault(id, userId, businessId) {
    const existing = await this.getById(id, userId, businessId);
    if (!existing) return null;

    try {
      await db.query(
        'UPDATE customer_addresses SET is_default = false WHERE user_id = $1 AND business_id = $2',
        [userId, businessId]
      );
      const res = await db.query(
        'UPDATE customer_addresses SET is_default = true WHERE id = $1 AND user_id = $2 AND business_id = $3 RETURNING *',
        [id, userId, businessId]
      );
      return res.rows[0];
    } catch (err) {

      throw err;
    }
  }

  async delete(id, userId, businessId) {
    const existing = await this.getById(id, userId, businessId);
    if (!existing) return false;

    const wasDefault = existing.is_default;

    try {
      await db.query('DELETE FROM customer_addresses WHERE id = $1 AND user_id = $2 AND business_id = $3', [id, userId, businessId]);
      
      // If was default, optionally elect another address as default
      if (wasDefault) {
        const remaining = await db.query(
          'SELECT id FROM customer_addresses WHERE user_id = $1 AND business_id = $2 ORDER BY id DESC LIMIT 1',
          [userId, businessId]
        );
        if (remaining.rows[0]) {
          await db.query('UPDATE customer_addresses SET is_default = true WHERE id = $1', [remaining.rows[0].id]);
        }
      }
      return true;
    } catch (err) {

      throw err;
    }
  }

  // Testing helpers
  _resetMemoryAddresses() {
    memoryAddresses = JSON.parse(JSON.stringify(INITIAL_ADDRESSES));
    nextAddressId = 10;
  }

  _getMemoryAddresses() {
    return memoryAddresses;
  }
}

module.exports = new AddressRepository();
