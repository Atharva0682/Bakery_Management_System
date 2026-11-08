/**
 * Universal Revenue Rules & Timezone Management
 * 
 * Strict business rule:
 * An order counts as revenue ONLY if:
 * 1. payment_status = 'Paid' (UPI/card after approval, COD after marked paid)
 * 2. order_status NOT IN ('Rejected', 'Cancelled', 'Refunded')
 * 
 * Pending verification, rejected, unpaid, and cancelled orders contribute ₹0.00.
 * Timezone: Asia/Kolkata (UTC +05:30) with Monday week-start.
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns SQL fragment enforcing the revenue condition.
 * @param {string} alias - table prefix (e.g. 'o', 'orders', '')
 */
function getRevenueSqlCondition(alias = '') {
  const p = alias ? `${alias}.` : '';
  return `${p}payment_status = 'Paid' AND ${p}order_status NOT IN ('Rejected', 'Cancelled', 'Refunded')`;
}

/**
 * Checks in-memory if an order row/object qualifies as recognized revenue.
 */
function isRevenueOrder(order) {
  if (!order) return false;
  const payStatus = order.payment_status;
  const ordStatus = order.order_status || order.status;
  return payStatus === 'Paid' && !['Rejected', 'Cancelled', 'Refunded'].includes(ordStatus);
}

/**
 * Converts a JavaScript Date or ISO string into YYYY-MM-DD in Asia/Kolkata timezone
 */
function getKolkataDateString(date = new Date()) {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d); // Returns 'YYYY-MM-DD'
}

/**
 * Returns 3-letter day name in Asia/Kolkata (e.g. 'Mon', 'Tue')
 */
function getKolkataDayName(date = new Date()) {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    weekday: 'short',
  }).format(d);
}

/**
 * Formats a Date object to SQLite UTC datetime string 'YYYY-MM-DD HH:MM:SS'
 */
function toSqlDateTime(date) {
  const d = new Date(date);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Converts a Kolkata calendar date 'YYYY-MM-DD' with time '00:00:00' or '23:59:59.999' into UTC Date object
 */
function kolkataDateToUtc(dateStr, isEnd = false) {
  const timeStr = isEnd ? '23:59:59.999+05:30' : '00:00:00+05:30';
  return new Date(`${dateStr}T${timeStr}`);
}

/**
 * Returns list of sequential dates between start and end (inclusive)
 */
function getDatesInRange(startDateStr, endDateStr) {
  const dates = [];
  let curr = new Date(`${startDateStr}T12:00:00+05:30`);
  const end = new Date(`${endDateStr}T12:00:00+05:30`);
  while (curr <= end) {
    const dStr = getKolkataDateString(curr);
    dates.push({
      dateStr: dStr,
      dayName: getKolkataDayName(curr)
    });
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/**
 * Returns { dateStr, startIso, endIso, startSql, endSql } for Today in Asia/Kolkata
 */
function getKolkataTodayBounds() {
  const dateStr = getKolkataDateString(new Date());
  const start = kolkataDateToUtc(dateStr, false);
  const end = kolkataDateToUtc(dateStr, true);
  return {
    dateStr,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: toSqlDateTime(start),
    endSql: toSqlDateTime(end),
    days: [{ dateStr, dayName: getKolkataDayName(start) }]
  };
}

/**
 * Returns { mondayDateStr, sundayDateStr, startIso, endIso, startSql, endSql, days } for This Week (Monday start)
 */
function getKolkataThisWeekBounds() {
  const now = new Date();
  const todayStr = getKolkataDateString(now);
  const [y, m, d] = todayStr.split('-').map(Number);
  
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = getKolkataDateString(monday);
  const sundayStr = getKolkataDateString(sunday);

  const start = kolkataDateToUtc(mondayStr, false);
  const end = kolkataDateToUtc(sundayStr, true);

  return {
    mondayDateStr: mondayStr,
    sundayDateStr: sundayStr,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: toSqlDateTime(start),
    endSql: toSqlDateTime(end),
    days: getDatesInRange(mondayStr, sundayStr)
  };
}

/**
 * Returns bounds for Last Week (Monday to Sunday)
 */
function getKolkataLastWeekBounds() {
  const thisWeek = getKolkataThisWeekBounds();
  const [y, m, d] = thisWeek.mondayDateStr.split('-').map(Number);
  const lastMon = new Date(y, m - 1, d - 7, 12, 0, 0);
  const lastSun = new Date(y, m - 1, d - 1, 12, 0, 0);

  const mondayStr = getKolkataDateString(lastMon);
  const sundayStr = getKolkataDateString(lastSun);

  const start = kolkataDateToUtc(mondayStr, false);
  const end = kolkataDateToUtc(sundayStr, true);

  return {
    mondayDateStr: mondayStr,
    sundayDateStr: sundayStr,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: toSqlDateTime(start),
    endSql: toSqlDateTime(end),
    days: getDatesInRange(mondayStr, sundayStr)
  };
}

/**
 * Returns bounds for This Month (1st to last day)
 */
function getKolkataThisMonthBounds() {
  const todayStr = getKolkataDateString(new Date());
  const [y, m] = todayStr.split('-').map(Number);
  
  const firstDayStr = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const lastDayStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const start = kolkataDateToUtc(firstDayStr, false);
  const end = kolkataDateToUtc(lastDayStr, true);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: toSqlDateTime(start),
    endSql: toSqlDateTime(end),
    days: getDatesInRange(firstDayStr, lastDayStr)
  };
}

/**
 * Returns bounds for last N days ending today
 */
function getKolkataLastNDaysBounds(n = 7) {
  const todayStr = getKolkataDateString(new Date());
  const [y, m, d] = todayStr.split('-').map(Number);
  const startDay = new Date(y, m - 1, d - (n - 1), 12, 0, 0);
  const startDayStr = getKolkataDateString(startDay);

  const start = kolkataDateToUtc(startDayStr, false);
  const end = kolkataDateToUtc(todayStr, true);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: toSqlDateTime(start),
    endSql: toSqlDateTime(end),
    days: getDatesInRange(startDayStr, todayStr)
  };
}

/**
 * Universal range resolver supporting 'today', 'this_week', 'last_week', 'this_month', 'last_7_days', 'custom'
 */
function getDateRangeBounds(range = 'this_week', customStart = null, customEnd = null) {
  switch (range) {
    case 'today':
      return getKolkataTodayBounds();
    case 'last_week':
      return getKolkataLastWeekBounds();
    case 'quarterly':
    case 'half_yearly':
    case 'yearly': {
      const [year, month] = getKolkataDateString().split('-').map(Number);
      const span = range === 'quarterly' ? 3 : range === 'half_yearly' ? 6 : 12;
      const firstMonth = Math.floor((month - 1) / span) * span + 1;
      const first = `${year}-${String(firstMonth).padStart(2, '0')}-01`;
      const endMonth = firstMonth + span - 1;
      const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
      const last = `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`;
      const start = kolkataDateToUtc(first, false), end = kolkataDateToUtc(last, true);
      return { startIso: start.toISOString(), endIso: end.toISOString(), startSql: toSqlDateTime(start), endSql: toSqlDateTime(end), days: getDatesInRange(first, last) };
    }
    case 'this_month':
      return getKolkataThisMonthBounds();
    case 'last_7_days':
      return getKolkataLastNDaysBounds(7);
    case 'custom':
      if (customStart && customEnd) {
        const s = getKolkataDateString(new Date(customStart));
        const e = getKolkataDateString(new Date(customEnd));
        const start = kolkataDateToUtc(s, false);
        const end = kolkataDateToUtc(e, true);
        return {
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          startSql: toSqlDateTime(start),
          endSql: toSqlDateTime(end),
          days: getDatesInRange(s, e)
        };
      }
      return getKolkataThisWeekBounds();
    case 'this_week':
    default:
      return getKolkataThisWeekBounds();
  }
}

module.exports = {
  TIMEZONE,
  getRevenueSqlCondition,
  isRevenueOrder,
  getKolkataDateString,
  getKolkataDayName,
  toSqlDateTime,
  kolkataDateToUtc,
  getDatesInRange,
  getKolkataTodayBounds,
  getKolkataThisWeekBounds,
  getKolkataLastWeekBounds,
  getKolkataThisMonthBounds,
  getKolkataLastNDaysBounds,
  getDateRangeBounds,
};
