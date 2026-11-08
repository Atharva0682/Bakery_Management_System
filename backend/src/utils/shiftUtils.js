/**
 * Shift Utility Functions for Bakery Management System
 * Business Timezone: Asia/Kolkata
 */

/**
 * Format 24-hour time "HH:mm" to 12-hour "hh:mm A" (e.g., "13:00" -> "01:00 PM")
 */
function formatTime12(time24) {
  if (!time24) return '';
  const [hStr, mStr] = String(time24).split(':');
  let h = parseInt(hStr, 10);
  const m = String(mStr || '00').padStart(2, '0');
  if (isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

/**
 * Format 24-hour time to concise 12-hour format without leading zero for hours (e.g., "13:00" -> "1:00 PM")
 */
function formatTime12Short(time24) {
  if (!time24) return '';
  const [hStr, mStr] = String(time24).split(':');
  let h = parseInt(hStr, 10);
  const m = String(mStr || '00').padStart(2, '0');
  if (isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Get current time in Asia/Kolkata as { hours, minutes, totalMinutes }
 */
function getKolkataTime(refDate = new Date()) {
  const dateObj = typeof refDate === 'string' || typeof refDate === 'number' ? new Date(refDate) : refDate;
  // Use Intl.DateTimeFormat to reliably extract Kolkata time regardless of system timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(dateObj);
  let h = 0, m = 0, s = 0;
  for (const part of parts) {
    if (part.type === 'hour') h = parseInt(part.value, 10);
    if (part.type === 'minute') m = parseInt(part.value, 10);
    if (part.type === 'second') s = parseInt(part.value, 10);
  }
  // hour12: false in some engines returns 24 for midnight
  if (h === 24) h = 0;

  return {
    hours: h,
    minutes: m,
    seconds: s,
    totalMinutes: h * 60 + m
  };
}

/**
 * Parse "HH:mm" into total minutes from 00:00
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(n => parseInt(n, 10));
  if (isNaN(h)) return null;
  return h * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Format minute duration into "Xh Ym", "Xh", or "Ym"
 */
function formatDuration(mins) {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Check if a given time is within a shift window (supports midnight-crossing overnight shifts)
 */
function isUserCurrentlyOnShift(shiftStart, shiftEnd, refDate = new Date()) {
  if (!shiftStart || !shiftEnd) return false;
  const startMins = parseTimeToMinutes(shiftStart);
  const endMins = parseTimeToMinutes(shiftEnd);
  if (startMins === null || endMins === null) return false;

  const { totalMinutes: nowMins } = getKolkataTime(refDate);

  if (endMins < startMins) {
    // Overnight shift crossing midnight (e.g. 22:00 to 06:00)
    return nowMins >= startMins || nowMins < endMins;
  }
  // Standard day shift (e.g. 05:00 to 13:00)
  return nowMins >= startMins && nowMins < endMins;
}

/**
 * Calculate detailed shift status
 * @param {Object} params
 * @param {string} params.shift_name
 * @param {string} params.shift_start (24h, "05:00")
 * @param {string} params.shift_end (24h, "13:00")
 * @param {Date|number|string} [params.refDate] Server time or reference date
 * @param {boolean} [params.isClockedIn] Whether baker is currently logged in/clocked in
 * @param {boolean} [params.hasActiveBatch] Whether baker currently has a running production batch
 */
function calculateShiftStatus({
  shift_name,
  shift_start,
  shift_end,
  refDate = new Date(),
  isClockedIn = false,
  hasActiveBatch = false
}) {
  if (!shift_start || !shift_end) {
    return {
      state: 'NO_SHIFT',
      statusText: 'No shift assigned',
      subText: '',
      formattedShift: 'No shift assigned',
      progressPercent: 0,
      isOutsideShift: false,
      isOvertime: false,
      overtimeText: null,
      shiftWindowText: ''
    };
  }

  const startMins = parseTimeToMinutes(shift_start);
  const endMins = parseTimeToMinutes(shift_end);

  if (startMins === null || endMins === null) {
    return {
      state: 'NO_SHIFT',
      statusText: 'No shift assigned',
      subText: '',
      formattedShift: 'No shift assigned',
      progressPercent: 0,
      isOutsideShift: false,
      isOvertime: false,
      overtimeText: null,
      shiftWindowText: ''
    };
  }

  const formattedStart = formatTime12(shift_start);
  const formattedEnd = formatTime12(shift_end);
  const shortEnd = formatTime12Short(shift_end);
  const shiftWindowText = `(${formattedStart} - ${formattedEnd})`;
  const formattedShift = shift_name ? `${shift_name} ${shiftWindowText}` : shiftWindowText;

  const isOvernight = endMins < startMins;
  const shiftDurationMins = isOvernight ? (1440 - startMins + endMins) : (endMins - startMins);

  const { totalMinutes: nowMins } = getKolkataTime(refDate);

  let onShift = false;
  let elapsedMins = 0;
  let remainingMins = 0;
  let minutesUntilStart = 0;
  let minutesAfterEnd = 0;

  if (!isOvernight) {
    // Normal day shift: startMins <= now < endMins
    if (nowMins >= startMins && nowMins < endMins) {
      onShift = true;
      elapsedMins = nowMins - startMins;
      remainingMins = endMins - nowMins;
    } else if (nowMins < startMins) {
      minutesUntilStart = startMins - nowMins;
    } else {
      // nowMins >= endMins
      minutesAfterEnd = nowMins - endMins;
    }
  } else {
    // Overnight shift (e.g. 22:00 to 06:00)
    if (nowMins >= startMins) {
      onShift = true;
      elapsedMins = nowMins - startMins;
      remainingMins = (1440 - nowMins) + endMins;
    } else if (nowMins < endMins) {
      onShift = true;
      elapsedMins = (1440 - startMins) + nowMins;
      remainingMins = endMins - nowMins;
    } else {
      // Outside overnight shift (e.g. between 06:00 and 22:00)
      minutesAfterEnd = nowMins - endMins;
      minutesUntilStart = startMins - nowMins;
    }
  }

  if (onShift) {
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMins / shiftDurationMins) * 100)));
    return {
      state: 'ON_SHIFT',
      statusText: `On shift · ${formatDuration(remainingMins)} left`,
      subText: `${progressPercent}% completed (${formatDuration(elapsedMins)} elapsed)`,
      progressPercent,
      formattedShift,
      shiftWindowText,
      isOutsideShift: false,
      isOvertime: false,
      overtimeText: null,
      remainingMinutes: remainingMins,
      elapsedMinutes: elapsedMins
    };
  }

  if (minutesUntilStart > 0 && (!minutesAfterEnd || minutesUntilStart <= (1440 - shiftDurationMins) / 2)) {
    // Before shift
    return {
      state: 'BEFORE_SHIFT',
      statusText: `Shift starts in ${formatDuration(minutesUntilStart)}`,
      subText: `Starts at ${formattedStart}`,
      progressPercent: 0,
      formattedShift,
      shiftWindowText,
      isOutsideShift: true,
      isOvertime: false,
      overtimeText: null,
      minutesUntilStart
    };
  }

  // After shift
  const isOvertimeActive = Boolean(isClockedIn || hasActiveBatch);
  const overtimeMins = minutesAfterEnd > 0 ? minutesAfterEnd : (isOvernight ? (nowMins < startMins ? nowMins - endMins : 0) : nowMins - endMins);
  const overtimeText = isOvertimeActive && overtimeMins > 0 ? `Overtime +${formatDuration(overtimeMins)}` : null;

  return {
    state: 'AFTER_SHIFT',
    statusText: `Shift ended at ${shortEnd}`,
    subText: overtimeText ? overtimeText : `Ended at ${shortEnd}`,
    progressPercent: 100,
    formattedShift,
    shiftWindowText,
    isOutsideShift: true,
    isOvertime: isOvertimeActive && overtimeMins > 0,
    overtimeText,
    overtimeMinutes: overtimeMins
  };
}

module.exports = {
  formatTime12,
  formatTime12Short,
  getKolkataTime,
  parseTimeToMinutes,
  formatDuration,
  isUserCurrentlyOnShift,
  calculateShiftStatus
};
