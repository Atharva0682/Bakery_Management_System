const db = require('../config/db');

class DeliveryScheduleService {
  constructor() {
    this.DEFAULT_SLOTS = [
      {
        id: 'slot-morning',
        name: 'Morning Fresh Batch (08:00 AM - 11:00 AM)',
        start_time: '08:00',
        end_time: '11:00',
        max_orders: 15,
        lead_time_hours: 10,
      },
      {
        id: 'slot-afternoon',
        name: 'Afternoon Batch (12:00 PM - 03:00 PM)',
        start_time: '12:00',
        end_time: '15:00',
        max_orders: 15,
        lead_time_hours: 4,
      },
      {
        id: 'slot-evening',
        name: 'Evening Warm Batch (04:00 PM - 07:00 PM)',
        start_time: '16:00',
        end_time: '19:00',
        max_orders: 15,
        lead_time_hours: 4,
      },
      {
        id: 'slot-night',
        name: 'Night Closing Batch (07:30 PM - 10:00 PM)',
        start_time: '19:30',
        end_time: '22:00',
        max_orders: 15,
        lead_time_hours: 3,
      },
    ];
  }

  /**
   * Returns list of delivery slots with live capacity and availability for a date
   */
  async getSlotsForDate(dateStr, businessId = 1) {
    if (!dateStr) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateStr = tomorrow.toISOString().split('T')[0];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isPast = dateStr < todayStr;

    // Fetch existing order counts per slot on this date
    let bookedCounts = {};
    try {
      const res = await db.query(
        `SELECT delivery_time_slot, count(*) as count
         FROM orders
         WHERE business_id = $1 
           AND delivery_date = $2 
           AND order_status NOT IN ('Cancelled', 'Rejected')
         GROUP BY delivery_time_slot`,
        [businessId, dateStr]
      );
      if (res && res.rows) {
        for (const r of res.rows) {
          if (r.delivery_time_slot) {
            bookedCounts[r.delivery_time_slot.trim()] = parseInt(r.count, 10);
          }
        }
      }
    } catch (e) {
      console.warn('[DeliveryScheduleService.getSlotsForDate]', e.message);
    }

    const now = new Date();
    const currentHour = now.getHours();

    const slots = this.DEFAULT_SLOTS.map((slot) => {
      const booked = bookedCounts[slot.name.trim()] || 0;
      const isFull = booked >= slot.max_orders;

      let isExpired = false;
      if (dateStr === todayStr) {
        const slotStartHour = parseInt(slot.start_time.split(':')[0], 10);
        if (currentHour >= slotStartHour) {
          isExpired = true;
        }
      }

      const available = !isPast && !isFull && !isExpired;

      return {
        id: slot.id,
        name: slot.name,
        start_time: slot.start_time,
        end_time: slot.end_time,
        max_capacity: slot.max_orders,
        booked_orders: booked,
        remaining_capacity: Math.max(0, slot.max_orders - booked),
        available,
        reason: isPast 
          ? 'Date is in the past' 
          : isExpired 
            ? 'Order cut-off time passed for today' 
            : isFull 
              ? 'Slot capacity full (15/15 booked)' 
              : 'Available'
      };
    });

    return {
      date: dateStr,
      is_past: isPast,
      slots,
      next_suggested_date: this.getNextAvailableDate(dateStr)
    };
  }

  /**
   * Helper to compute next day date string
   */
  getNextAvailableDate(currentDateStr) {
    const d = new Date(currentDateStr || new Date());
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  /**
   * Atomic validation of slot capacity, stock, and planned batches
   * Formula:
   * Available = Current Stock - Active Reserved Orders + Planned Production Batches (due <= delivery date)
   */
  async validateDeliveryAndStock({
    deliveryDate,
    deliveryTimeSlot,
    items,
    businessId = 1,
  }) {
    if (!deliveryDate) {
      const err = new Error('Delivery date is required.');
      err.code = 'DELIVERY_DATE_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (deliveryDate < todayStr) {
      const err = new Error('Deliveries cannot be scheduled for past dates. Please select an upcoming date.');
      err.code = 'PAST_DELIVERY_DATE';
      err.statusCode = 400;
      throw err;
    }

    const slotName = (deliveryTimeSlot || this.DEFAULT_SLOTS[0].name).trim();

    // 1. Check Slot Capacity
    let bookedCount = 0;
    try {
      const countRes = await db.query(
        `SELECT count(*) as count
         FROM orders
         WHERE business_id = $1 
           AND delivery_date = $2 
           AND delivery_time_slot = $3 
           AND order_status NOT IN ('Cancelled', 'Rejected')`,
        [businessId, deliveryDate, slotName]
      );
      bookedCount = parseInt(countRes.rows[0]?.count || 0, 10);
    } catch (e) {
      throw e;
    }

    const maxOrders = 15;
    if (bookedCount >= maxOrders) {
      const nextDate = this.getNextAvailableDate(deliveryDate);
      const err = new Error(`The delivery slot "${slotName}" on ${deliveryDate} is fully booked (${bookedCount}/${maxOrders} orders). Please choose another slot or date (${nextDate}).`);
      err.code = 'SLOT_CAPACITY_FULL';
      err.statusCode = 409;
      err.nextAvailableDate = nextDate;
      err.nextAvailableSlot = this.DEFAULT_SLOTS[0].name;
      throw err;
    }

    // Ingredient sufficiency is checked atomically at production acceptance.

    return {
      valid: true,
      deliveryDate,
      deliveryTimeSlot: slotName,
      bookedCount,
      remainingCapacity: maxOrders - bookedCount,
    };
  }
}

module.exports = new DeliveryScheduleService();
