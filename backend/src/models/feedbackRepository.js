const db = require('../config/db');

const INITIAL_FEEDBACK = [
  {
    id: 1,
    business_id: 1,
    order_id: 1,
    user_id: 4, // Ananya Nair
    batch_id: 1,
    product_id: 2,
    rating_overall: 5,
    rating_taste: 5,
    rating_freshness: 5,
    rating_delivery: 5,
    comment: 'Hands down the flakiest Butter Croissants in Bandra! Arrived warm.',
    tags: ['Fresh', 'Warm', 'Authentic'],
    is_complaint: false,
    category: 'General Feedback',
    status: 'Acknowledged',
    points_awarded: 50,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 10,
    business_id: 2,
    order_id: 10,
    user_id: 13, // Vikram Mehta (Business 2)
    batch_id: 10,
    product_id: 10,
    rating_overall: 5,
    rating_taste: 5,
    rating_freshness: 5,
    rating_delivery: 5,
    comment: 'Authentic Parisian crust on the baguette. Outstanding.',
    tags: ['Authentic', 'Crispy'],
    is_complaint: false,
    category: 'General Feedback',
    status: 'Acknowledged',
    points_awarded: 50,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

let memoryFeedback = JSON.parse(JSON.stringify(INITIAL_FEEDBACK));
let nextFeedbackId = 20;

class FeedbackRepository {
  async getByUserId(userId, businessId) {
    try {
      const res = await db.query(
        'SELECT * FROM customer_feedback WHERE user_id = $1 AND business_id = $2 ORDER BY created_at DESC, id DESC',
        [userId, businessId]
      );
      return res.rows;
    } catch (err) {

      throw err;
    }
  }

  async getById(id, userId = null, businessId = null) {
    try {
      let query = 'SELECT * FROM customer_feedback WHERE id = $1';
      const params = [id];
      if (userId) {
        query += ' AND user_id = $2';
        params.push(userId);
      }
      if (businessId) {
        query += ` AND business_id = $${params.length + 1}`;
        params.push(businessId);
      }
      const res = await db.query(query, params);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async hasFeedbackForOrder(orderId) {
    try {
      const res = await db.query('SELECT id FROM customer_feedback WHERE order_id = $1', [orderId]);
      return Boolean(res.rows[0]);
    } catch (err) {

      throw err;
    }
  }

  async createFeedback({
    business_id,
    order_id,
    user_id,
    batch_id = null,
    product_id = null,
    rating_overall,
    rating_taste = 5,
    rating_freshness = 5,
    rating_delivery = 5,
    rating_packaging = 5,
    comment,
    tags = [],
    is_complaint = false,
    category = 'General Feedback',
    status = 'Acknowledged',
    points_awarded = 50,
  }) {
    try {
      const overall = parseInt(rating_overall, 10) || 5;
      const res = await db.query(
        `INSERT INTO customer_feedback (business_id, order_id, user_id, batch_id, rating, rating_overall, taste_rating, freshness_rating, packaging_rating, delivery_rating, comment, is_complaint)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [business_id, order_id, user_id, batch_id, overall, overall, rating_taste, rating_freshness, rating_packaging || 5, rating_delivery, comment, is_complaint]
      );
      return {
        ...res.rows[0],
        rating_taste,
        rating_freshness,
        rating_delivery,
        tags,
        product_id,
        category,
        status,
        points_awarded,
      };
    } catch (err) {

      throw err;
    }
  }

  // Testing helpers
  _resetMemoryFeedback() {
    memoryFeedback = JSON.parse(JSON.stringify(INITIAL_FEEDBACK));
    nextFeedbackId = 20;
  }

  _getMemoryFeedback() {
    return memoryFeedback;
  }
}

module.exports = new FeedbackRepository();
