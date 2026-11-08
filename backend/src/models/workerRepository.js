const db = require('../config/db');
const { formatTime12, isUserCurrentlyOnShift } = require('../utils/shiftUtils');
const isWorkerCurrentlyOnShift = isUserCurrentlyOnShift;

class WorkerRepository {
  async getAllWorkers(businessId = 1) {
    try {
      if (db.isConnected()) {
        const res = await db.query(
          `SELECT u.id, u.business_id, u.name, u.role, u.email, u.phone, 
                  u.shift, u.shift_name, u.shift_start, u.shift_end, u.is_clocked_in, u.hourly_rate,
                  u.is_active, u.dismissed_at, u.dismissal_reason,
             CASE 
               WHEN u.hourly_rate > 0 THEN u.hourly_rate * 8 
               WHEN u.role = 'manager' THEN 1500.00
               WHEN u.role = 'baker' THEN 1200.00
               ELSE 800.00 
             END as daily_wage,
             8 as hours_worked
           FROM users u
           WHERE u.business_id = $1 
             AND u.role IN ('baker', 'staff', 'manager') 
           ORDER BY u.id ASC`,
          [businessId]
        );

        if (res.rows && res.rows.length > 0) {
          // Enrich with active production batch assignments and real shift calculation
          const enriched = await Promise.all(
            res.rows.map(async (w) => {
              let activeBatch = null;
              const isActive = Boolean(w.is_active !== 0 && w.is_active !== false);

              if (isActive) {
                try {
                  const bRes = await db.query(
                    `SELECT pb.batch_no, pb.status, p.name as product_name
                     FROM production_batches pb
                     JOIN products p ON pb.product_id = p.id
                     WHERE pb.baker_id = $1 AND pb.status IN ('In Production', 'Accepted', 'Baking', 'Quality Check')
                     ORDER BY pb.id DESC LIMIT 1`,
                    [w.id]
                  );
                  if (bRes.rows && bRes.rows.length > 0) {
                    activeBatch = `${bRes.rows[0].batch_no} (${bRes.rows[0].product_name})`;
                  }
                } catch (e) {}
              }

              let displayRole = 'Bakery Specialist';
              if (w.role === 'manager') displayRole = 'Kitchen & Operations Manager';
              else if (w.role === 'baker') displayRole = 'Artisanal Deck Baker';
              else if (w.role === 'staff') displayRole = 'Packaging & Dispatch Staff';

              const onShift = isActive && isWorkerCurrentlyOnShift(w.shift_start, w.shift_end);
              const isClockedIn = isActive && Boolean(w.is_clocked_in);
              const isOnFloor = isActive && ((isClockedIn && onShift) || Boolean(activeBatch));

              let status = 'Off Shift';
              if (!isActive) {
                status = 'Dismissed';
              } else if (isOnFloor) {
                status = 'On Floor';
              } else if (isClockedIn) {
                status = 'Clocked In (Off Shift)';
              }

              let formattedShift = 'No shift assigned';
              if (w.shift_name && w.shift_start && w.shift_end) {
                formattedShift = `${w.shift_name} (${formatTime12(w.shift_start)} - ${formatTime12(w.shift_end)})`;
              } else if (w.shift_name) {
                formattedShift = w.shift_name;
              } else if (w.shift && !w.shift.toLowerCase().includes('morning shift')) {
                formattedShift = w.shift;
              }

              return {
                id: w.id,
                name: w.name,
                role: displayRole,
                raw_role: w.role,
                email: w.email,
                phone: w.phone,
                shift: formattedShift,
                shift_name: w.shift_name || null,
                shift_start: w.shift_start || null,
                shift_end: w.shift_end || null,
                is_active: isActive,
                dismissed_at: w.dismissed_at || null,
                dismissal_reason: w.dismissal_reason || null,
                is_clocked_in: isClockedIn,
                hourly_rate: parseFloat(w.hourly_rate !== null && w.hourly_rate !== undefined ? w.hourly_rate : (parseFloat(w.daily_wage || 1000) / 8)),
                daily_wage: parseFloat(w.daily_wage || 1000),
                total_cost: parseFloat(w.daily_wage || 1000),
                hours_logged: '8.0 hrs',
                hours_worked: 8,
                status: status,
                is_on_floor: isOnFloor,
                active_batch: activeBatch || 'Floor Operations Standby',
                rating: '5.0 ★'
              };
            })
          );
          return enriched;
        }
      }
    } catch (err) {
      throw err;
    }
    return [];
  }

  async getAttendanceSummary(businessId = 1) {
    const list = await this.getAllWorkers(businessId);
    const activeWorkers = list.filter(w => w.is_active);
    const dismissedWorkers = list.filter(w => !w.is_active);
    const totalWageCost = activeWorkers.reduce((sum, w) => sum + (parseFloat(w.daily_wage) || 0), 0);
    const activeStaffOnFloor = activeWorkers.filter(w => w.status === 'On Floor' || w.is_on_floor).length;

    return {
      totalStaff: activeWorkers.length,
      totalDismissed: dismissedWorkers.length,
      totalAll: list.length,
      activeToday: activeStaffOnFloor,
      activeStaffOnFloor: activeStaffOnFloor,
      totalWageCostToday: totalWageCost,
      workers: list
    };
  }

  async onboardWorker({
    businessId = 1,
    name,
    email,
    phone,
    role = 'baker',
    password,
    shift_name = null,
    shift_start = null,
    shift_end = null,
    shift = null,
    dailyWage = 1000
  }) {
    if (!name || !name.trim()) {
      const err = new Error('Full Name is required.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }
    if (!email || !email.trim()) {
      const err = new Error('Email Address is required.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }
    if (!['baker', 'staff', 'manager'].includes(role)) {
      const err = new Error('Role must be baker, staff, or manager.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }
    const parsedWage = parseFloat(dailyWage);
    if (isNaN(parsedWage) || parsedWage <= 0) {
      const err = new Error('Daily Wage must be a valid positive amount.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    let rawPassword = password;
    if (!rawPassword || typeof rawPassword !== 'string' || !rawPassword.trim()) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let randCode = '';
      for (let i = 0; i < 4; i++) {
        randCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      rawPassword = `Bake@${randCode}!26`;
    } else if (rawPassword.trim().length < 6) {
      const err = new Error('Password must be at least 6 characters long.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    // Check if email already exists
    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows && existing.rows.length > 0) {
      const err = new Error(`Staff member with email "${cleanEmail}" is already registered.`);
      err.code = 'EMAIL_EXISTS';
      err.statusCode = 409;
      throw err;
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(rawPassword.trim(), 10);
    const hourlyRate = parsedWage / 8;

    let fullShiftText = shift || null;
    if (shift_name && shift_start && shift_end) {
      fullShiftText = `${shift_name} (${formatTime12(shift_start)} - ${formatTime12(shift_end)})`;
    } else if (shift_name) {
      fullShiftText = shift_name;
    }

    const res = await db.query(
      `INSERT INTO users (business_id, name, email, phone, password_hash, role, shift, shift_name, shift_start, shift_end, hourly_rate, must_change_password, is_active, is_clocked_in)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 1, 0)
       RETURNING id, business_id, name, email, phone, role, shift, shift_name, shift_start, shift_end, hourly_rate, is_active, created_at`,
      [businessId, name.trim(), cleanEmail, phone ? phone.trim() : null, passwordHash, role, fullShiftText, shift_name || null, shift_start || null, shift_end || null, hourlyRate]
    );

    const newUser = res.rows[0];
    return {
      user: {
        ...newUser,
        daily_wage: parsedWage
      },
      temporary_password: rawPassword
    };
  }

  async updateWorker(workerId, {
    name,
    phone,
    role,
    shift_name,
    shift_start,
    shift_end,
    dailyWage,
    password,
    is_active
  }, businessId = 1) {
    const existing = await db.query('SELECT * FROM users WHERE id = $1 AND business_id = $2', [workerId, businessId]);
    if (!existing.rows || existing.rows.length === 0) {
      const err = new Error('Staff member not found.');
      err.code = 'WORKER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const targetUser = existing.rows[0];
    if (targetUser.role === 'owner') {
      const err = new Error('Cannot modify owner accounts via worker management.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    if (role && role === 'owner') {
      const err = new Error('Cannot elevate staff to owner role.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    let fullShiftText;
    if (shift_name !== undefined || shift_start !== undefined || shift_end !== undefined) fullShiftText = null;
    if (shift_name && shift_start && shift_end) {
      fullShiftText = `${shift_name} (${formatTime12(shift_start)} - ${formatTime12(shift_end)})`;
    } else if (shift_name) {
      fullShiftText = shift_name;
    }

    const hourlyRate = dailyWage !== undefined ? (parseFloat(dailyWage) / 8) : undefined;

    const fields = [];
    const values = [];
    let pIdx = 1;

    if (name !== undefined) { fields.push(`name = $${pIdx++}`); values.push(name.trim()); }
    if (phone !== undefined) { fields.push(`phone = $${pIdx++}`); values.push(phone ? phone.trim() : null); }
    if (role !== undefined && ['baker', 'staff', 'manager'].includes(role)) { fields.push(`role = $${pIdx++}`); values.push(role); }
    if (fullShiftText !== undefined) { fields.push(`shift = $${pIdx++}`); values.push(fullShiftText); }
    if (shift_name !== undefined) { fields.push(`shift_name = $${pIdx++}`); values.push(shift_name); }
    if (shift_start !== undefined) { fields.push(`shift_start = $${pIdx++}`); values.push(shift_start); }
    if (shift_end !== undefined) { fields.push(`shift_end = $${pIdx++}`); values.push(shift_end); }
    if (hourlyRate !== undefined) { fields.push(`hourly_rate = $${pIdx++}`); values.push(hourlyRate); }
    if (is_active !== undefined) { fields.push(`is_active = $${pIdx++}`); values.push(is_active ? 1 : 0); }

    // Optional password reset
    if (password && typeof password === 'string' && password.trim().length > 0) {
      if (password.trim().length < 6) {
        const err = new Error('New password must be at least 6 characters long.');
        err.code = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
      }
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      fields.push(`password_hash = $${pIdx++}`);
      values.push(passwordHash);
    }

    if (fields.length === 0) return existing.rows[0];

    values.push(workerId);
    values.push(businessId);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${pIdx++} AND business_id = $${pIdx++} RETURNING id, business_id, name, email, phone, role, shift, hourly_rate, is_active, dismissed_at, dismissal_reason`;
    const res = await db.query(sql, values);
    return res.rows[0];
  }

  async dismissWorker(workerId, { reason } = {}, businessId = 1, requestingUser = null) {
    const existing = await db.query('SELECT * FROM users WHERE id = $1 AND business_id = $2', [workerId, businessId]);
    if (!existing.rows || existing.rows.length === 0) {
      const err = new Error('Staff member not found.');
      err.code = 'WORKER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const targetUser = existing.rows[0];
    if (targetUser.role === 'owner') {
      const err = new Error('Owner accounts cannot be dismissed.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    if (requestingUser && String(requestingUser.id) === String(workerId)) {
      const err = new Error('You cannot dismiss your own account.');
      err.code = 'FORBIDDEN';
      err.statusCode = 400;
      throw err;
    }

    const sql = `
      UPDATE users 
      SET is_active = 0, 
          dismissed_at = CURRENT_TIMESTAMP, 
          dismissal_reason = $1, 
          is_clocked_in = 0 
      WHERE id = $2 AND business_id = $3 
      RETURNING id, business_id, name, email, phone, role, is_active, dismissed_at, dismissal_reason
    `;
    const res = await db.query(sql, [reason ? reason.trim() : 'Dismissed by management', workerId, businessId]);
    return res.rows[0];
  }

  async reactivateWorker(workerId, businessId = 1) {
    const existing = await db.query('SELECT * FROM users WHERE id = $1 AND business_id = $2', [workerId, businessId]);
    if (!existing.rows || existing.rows.length === 0) {
      const err = new Error('Staff member not found.');
      err.code = 'WORKER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const targetUser = existing.rows[0];
    if (targetUser.role === 'owner') {
      const err = new Error('Owner accounts cannot be modified here.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    const sql = `
      UPDATE users 
      SET is_active = 1, 
          dismissed_at = NULL, 
          dismissal_reason = NULL 
      WHERE id = $1 AND business_id = $2 
      RETURNING id, business_id, name, email, phone, role, is_active, dismissed_at, dismissal_reason
    `;
    const res = await db.query(sql, [workerId, businessId]);
    return res.rows[0];
  }
}

module.exports = new WorkerRepository();
