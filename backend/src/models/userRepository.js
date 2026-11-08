const db = require('../config/db');

class UserRepository {
  async findById(id) {
    try {
      const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async findByIdentifier(identifier, businessId = null) {
    if (!identifier) return null;
    const cleanIdentifier = identifier.trim().toLowerCase();
    try {
      let query = `
        SELECT * FROM users 
        WHERE (LOWER(email) = $1 OR phone = $2)
      `;
      const params = [cleanIdentifier, identifier.trim()];
      if (businessId) {
        query += ` AND business_id = $3`;
        params.push(businessId);
      }
      query += ` LIMIT 1`;

      const res = await db.query(query, params);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async create({ business_id, name, email, phone, password_hash, role = 'customer', shift = null }) {
    try {
      const query = `
        INSERT INTO users (business_id, name, email, phone, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `;
      const params = [business_id, name, email ? email.toLowerCase().trim() : null, phone.trim(), password_hash, role];
      const res = await db.query(query, params);
      return res.rows[0];
    } catch (err) {

      throw err;
    }
  }

  async update(id, updates) {
    try {
      const res = await db.query(
        `UPDATE users 
         SET name = COALESCE($1, name),
             phone = COALESCE($2, phone)
         WHERE id = $3 AND is_active = true
         RETURNING *`,
        [updates.name, updates.phone, id]
      );
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async getAllByBusiness(businessId, role = null) {
    try {
      let q = 'SELECT id, business_id, name, email, phone, role, is_active FROM users WHERE business_id = $1 AND is_active = true';
      const params = [businessId];
      if (role) {
        q += ' AND role = $2';
        params.push(role);
      }
      const res = await db.query(q, params);
      return res.rows;
    } catch (err) {

      throw err;
    }
  }

}

module.exports = new UserRepository();
