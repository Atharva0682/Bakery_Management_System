const feedbackRepository = require('../models/feedbackRepository');
const orderRepository = require('../models/orderRepository');

const VALID_CATEGORIES = [
  'General Feedback',
  'Product Quality',
  'Order Issue',
  'Payment Issue',
  'Delivery Issue',
  'Complaint',
];

class FeedbackService {
  async submitFeedback({ customerId, businessId, orderId, ratingData = {} }) {
    const {
      rating_overall,
      rating_taste,
      rating_freshness,
      rating_delivery,
      comment,
      tags,
      category,
      product_id,
      bakedAsExpected,
      status: clientStatus,
    } = ratingData;

    // Prevent customer from forging resolved or closed status
    if (clientStatus && (clientStatus.toLowerCase() === 'resolved' || clientStatus.toLowerCase() === 'closed')) {
      const err = new Error('Forbidden: Customer cannot mark feedback or complaints as resolved.');
      err.code = 'FORBIDDEN_STATUS_CHANGE';
      err.statusCode = 403;
      throw err;
    }

    // Rating validation: must be integer 1 to 5
    const overallNum = Number(rating_overall || ratingData.rating || ratingData.overall);
    if (!Number.isInteger(overallNum) || overallNum < 1 || overallNum > 5) {
      const err = new Error('Overall rating between 1 and 5 is required.');
      err.code = 'INVALID_RATING';
      err.statusCode = 400;
      throw err;
    }

    // Sub-criteria validation if supplied
    for (const [key, val] of Object.entries({ rating_taste, rating_freshness, rating_delivery })) {
      if (val !== undefined && val !== null) {
        const num = Number(val);
        if (!Number.isInteger(num) || num < 1 || num > 5) {
          const err = new Error(`Criterion '${key}' must be an integer between 1 and 5.`);
          err.code = 'INVALID_RATING';
          err.statusCode = 400;
          throw err;
        }
      }
    }

    // Comment validation
    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string') {
        const err = new Error('Comment must be text.');
        err.code = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
      }
      if (comment.length > 1000) {
        const err = new Error('Feedback comment cannot exceed 1000 characters.');
        err.code = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
      }
    }

    // Category validation
    if (category && !VALID_CATEGORIES.includes(category)) {
      const err = new Error(`Invalid feedback category '${category}'. Valid: ${VALID_CATEGORIES.join(', ')}`);
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    // Verify order exists
    if (!orderId) {
      const err = new Error('A valid order_id is required to submit feedback.');
      err.code = 'ORDER_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    const order = await orderRepository.getById(orderId);
    if (!order) {
      const err = new Error(`Order #${orderId} not found.`);
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Verify tenant match
    if (Number(order.business_id) !== Number(businessId)) {
      const err = new Error('Cannot review an order belonging to another bakery.');
      err.code = 'FORBIDDEN_TENANT';
      err.statusCode = 403;
      throw err;
    }

    // Verify customer ownership
    if (Number(order.customer_id) !== Number(customerId)) {
      const err = new Error('Access denied. You cannot submit feedback for an order placed by another customer.');
      err.code = 'FORBIDDEN_RESOURCE';
      err.statusCode = 403;
      throw err;
    }

    // Order eligibility: Cancelled orders cannot receive review/complaints
    if (order.order_status === 'Cancelled') {
      const err = new Error('Cancelled orders are not eligible for review or feedback.');
      err.code = 'ORDER_NOT_ELIGIBLE';
      err.statusCode = 400;
      throw err;
    }

    // Check duplicate feedback for this order
    const alreadyReviewed = await feedbackRepository.hasFeedbackForOrder(order.id);
    if (alreadyReviewed) {
      const err = new Error('Feedback has already been submitted for this order.');
      err.code = 'FEEDBACK_EXISTS';
      err.statusCode = 409;
      throw err;
    }

    // Product and production batch traceability
    const orderItems = await orderRepository.getOrderItems(order.id);
    let resolvedBatchId = null;
    let resolvedProductId = null;

    if (product_id) {
      const matchingItem = orderItems.find(
        (item) => Number(item.product_id) === Number(product_id) || Number(item.product_variant_id) === Number(product_id)
      );
      if (!matchingItem) {
        const err = new Error(`Product ID ${product_id} was not part of order #${order.order_no || order.id}.`);
        err.code = 'INVALID_PRODUCT';
        err.statusCode = 400;
        throw err;
      }
      resolvedProductId = matchingItem.product_id;
      resolvedBatchId = matchingItem.batch_id || null;
    } else if (orderItems && orderItems.length > 0) {
      // Preserve first available production batch for traceability
      const itemWithBatch = orderItems.find((i) => i.batch_id);
      if (itemWithBatch) {
        resolvedBatchId = itemWithBatch.batch_id;
        resolvedProductId = itemWithBatch.product_id;
      }
    }

    // Determine category and complaint classification
    let selectedCategory = category || 'General Feedback';

    const isComplaint = Boolean(
      ratingData.is_complaint ||
      bakedAsExpected === false ||
      overallNum <= 2 ||
      selectedCategory === 'Complaint' ||
      selectedCategory === 'Product Quality' ||
      selectedCategory === 'Order Issue' ||
      selectedCategory === 'Delivery Issue' ||
      selectedCategory === 'Payment Issue'
    );

    if (isComplaint && selectedCategory === 'General Feedback') {
      selectedCategory = 'Complaint';
    }

    // Server-authoritative status
    const authoritativeStatus = isComplaint ? 'Pending Review' : 'Acknowledged';

    const newFeedback = await feedbackRepository.createFeedback({
      business_id: businessId,
      order_id: order.id,
      user_id: customerId,
      batch_id: resolvedBatchId,
      product_id: resolvedProductId,
      rating_overall: overallNum,
      rating_taste: rating_taste ? Number(rating_taste) : overallNum,
      rating_freshness: rating_freshness ? Number(rating_freshness) : overallNum,
      rating_delivery: rating_delivery ? Number(rating_delivery) : overallNum,
      comment: comment ? comment.trim() : '',
      tags: Array.isArray(tags) ? tags : [],
      is_complaint: isComplaint,
      category: selectedCategory,
      status: authoritativeStatus,
      points_awarded: 50,
    });

    return {
      feedback: newFeedback,
      pointsAwarded: 50,
      message: isComplaint
        ? 'Your complaint has been submitted. Our bakery team is reviewing it.'
        : 'Thank you for your feedback! 50 Crumb Points have been credited.',
    };
  }

  async getCustomerFeedback(customerId, businessId) {
    const feedbackList = await feedbackRepository.getByUserId(customerId, businessId);

    // Enrich feedback with order number and items for customer view
    const enriched = await Promise.all(
      feedbackList.map(async (fb) => {
        const order = await orderRepository.getById(fb.order_id, businessId);
        const items = order ? await orderRepository.getOrderItems(order.id) : [];
        return {
          ...fb,
          order_no: order ? order.order_no : `ORD-${fb.order_id}`,
          order_date: order ? order.created_at : fb.created_at,
          order_items: items.map((i) => i.name || 'Bakery Item'),
        };
      })
    );

    return enriched;
  }
}

module.exports = new FeedbackService();
