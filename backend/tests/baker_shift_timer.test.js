/**
 * Comprehensive Shift Calculation, Status, Overtime, and Policy Tests
 * Timezone: Asia/Kolkata
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const {
  formatTime12,
  formatTime12Short,
  getKolkataTime,
  parseTimeToMinutes,
  formatDuration,
  isUserCurrentlyOnShift,
  calculateShiftStatus
} = require('../src/utils/shiftUtils');
const authService = require('../src/services/authService');
const workerRepository = require('../src/models/workerRepository');
const ownerRepository = require('../src/models/ownerRepository');
const db = require('../src/config/db');

async function runBakerShiftTests() {
  console.log('\n======================================================');
  console.log(' BAKER SHIFT DISPLAY, COUNTDOWN & TIMEZONE TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  const total = 9;

  // TEST 1: Before Shift ("Shift starts in 2h 10m")
  try {
    // 05:00 shift. At 02:50 AM Kolkata time (2 hours 10 mins before start)
    // 2026-10-18T02:50:00+05:30 -> in UTC is 2026-10-17T21:20:00Z
    const refDate = new Date('2026-10-17T21:20:00Z');
    const status = calculateShiftStatus({
      shift_name: 'Morning Shift',
      shift_start: '05:00',
      shift_end: '13:00',
      refDate,
      isClockedIn: false
    });

    assert.strictEqual(status.state, 'BEFORE_SHIFT', 'Must be BEFORE_SHIFT state');
    assert.strictEqual(status.statusText, 'Shift starts in 2h 10m', 'Status text must be "Shift starts in 2h 10m"');
    assert.strictEqual(status.isOutsideShift, true, 'isOutsideShift must be true');

    console.log('✓ TEST 1 PASSED: Before shift correctly reports "Shift starts in 2h 10m"');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: During Shift ("On shift · 3h 25m left" with progress bar)
  try {
    // 05:00 to 13:00 shift. At 09:35 AM Kolkata time (3 hours 25 mins left until 13:00)
    // 2026-10-18T09:35:00+05:30 -> in UTC is 2026-10-18T04:05:00Z
    const refDate = new Date('2026-10-18T04:05:00Z');
    const status = calculateShiftStatus({
      shift_name: 'Morning Shift',
      shift_start: '05:00',
      shift_end: '13:00',
      refDate,
      isClockedIn: true
    });

    assert.strictEqual(status.state, 'ON_SHIFT', 'Must be ON_SHIFT state');
    assert.strictEqual(status.statusText, 'On shift · 3h 25m left', 'Status text must be "On shift · 3h 25m left"');
    assert.ok(status.progressPercent > 50 && status.progressPercent < 60, `Progress should be around 57%, got ${status.progressPercent}%`);
    assert.strictEqual(status.isOutsideShift, false, 'isOutsideShift must be false');

    console.log('✓ TEST 2 PASSED: During shift correctly reports "On shift · 3h 25m left" with progress bar percentage');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: After Shift ("Shift ended at 1:00 PM")
  try {
    // 05:00 to 13:00 shift. At 13:05 PM Kolkata time
    // 2026-10-18T13:05:00+05:30 -> in UTC is 2026-10-18T07:35:00Z
    const refDate = new Date('2026-10-18T07:35:00Z');
    const status = calculateShiftStatus({
      shift_name: 'Morning Shift',
      shift_start: '05:00',
      shift_end: '13:00',
      refDate,
      isClockedIn: false
    });

    assert.strictEqual(status.state, 'AFTER_SHIFT', 'Must be AFTER_SHIFT state');
    assert.strictEqual(status.statusText, 'Shift ended at 1:00 PM', 'Status text must be "Shift ended at 1:00 PM"');
    assert.strictEqual(status.isOutsideShift, true, 'isOutsideShift must be true');

    console.log('✓ TEST 3 PASSED: After shift correctly reports "Shift ended at 1:00 PM"');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: 13:30 Login on a 05:00–13:00 Shift showing "Shift ended" and "Overtime +30m"
  try {
    // At 13:30 PM Kolkata time on 05:00-13:00 shift
    // 2026-10-18T13:30:00+05:30 -> in UTC is 2026-10-18T08:00:00Z
    const refDate = new Date('2026-10-18T08:00:00Z');
    const status = calculateShiftStatus({
      shift_name: 'Morning Shift',
      shift_start: '05:00',
      shift_end: '13:00',
      refDate,
      isClockedIn: true // Baker is logged in
    });

    assert.strictEqual(status.state, 'AFTER_SHIFT');
    assert.strictEqual(status.statusText, 'Shift ended at 1:00 PM');
    assert.strictEqual(status.overtimeText, 'Overtime +30m', 'Overtime text must be "Overtime +30m"');
    assert.strictEqual(status.isOvertime, true, 'isOvertime must be true');
    assert.strictEqual(status.isOutsideShift, true, 'isOutsideShift must be true');

    console.log('✓ TEST 4 PASSED: 13:30 login on 05:00-13:00 shift displays "Shift ended at 1:00 PM" and "Overtime +30m"');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // TEST 5: Overnight Shift Crossing Midnight (22:00 to 06:00)
  try {
    // 1) 23:30 (during overnight shift, pre-midnight)
    // 2026-10-18T23:30:00+05:30 -> in UTC is 2026-10-18T18:00:00Z
    const tPreMidnight = new Date('2026-10-18T18:00:00Z');
    const s1 = calculateShiftStatus({
      shift_name: 'Night Bake',
      shift_start: '22:00',
      shift_end: '06:00',
      refDate: tPreMidnight
    });
    assert.strictEqual(s1.state, 'ON_SHIFT');
    assert.strictEqual(s1.statusText, 'On shift · 6h 30m left');

    // 2) 04:00 (during overnight shift, post-midnight)
    // 2026-10-19T04:00:00+05:30 -> in UTC is 2026-10-18T22:30:00Z
    const tPostMidnight = new Date('2026-10-18T22:30:00Z');
    const s2 = calculateShiftStatus({
      shift_name: 'Night Bake',
      shift_start: '22:00',
      shift_end: '06:00',
      refDate: tPostMidnight
    });
    assert.strictEqual(s2.state, 'ON_SHIFT');
    assert.strictEqual(s2.statusText, 'On shift · 2h left');

    // 3) 06:45 (after overnight shift with active baker)
    // 2026-10-19T06:45:00+05:30 -> in UTC is 2026-10-19T01:15:00Z
    const tOvertime = new Date('2026-10-19T01:15:00Z');
    const s3 = calculateShiftStatus({
      shift_name: 'Night Bake',
      shift_start: '22:00',
      shift_end: '06:00',
      refDate: tOvertime,
      isClockedIn: true
    });
    assert.strictEqual(s3.state, 'AFTER_SHIFT');
    assert.strictEqual(s3.statusText, 'Shift ended at 6:00 AM');
    assert.strictEqual(s3.overtimeText, 'Overtime +45m');

    console.log('✓ TEST 5 PASSED: Overnight shift crossing midnight (22:00 - 06:00) fully supported before, during, and after midnight');
    passed++;
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  // TEST 6: No Shift Set (Strictly "No shift assigned", never a default fallback)
  try {
    const sNull = calculateShiftStatus({
      shift_name: null,
      shift_start: null,
      shift_end: null
    });

    assert.strictEqual(sNull.state, 'NO_SHIFT');
    assert.strictEqual(sNull.statusText, 'No shift assigned');
    assert.strictEqual(sNull.formattedShift, 'No shift assigned');
    assert.strictEqual(sNull.isOutsideShift, false);

    console.log('✓ TEST 6 PASSED: Baker with no shift set strictly shows "No shift assigned" without fallback');
    passed++;
  } catch (err) {
    console.error('✗ TEST 6 FAILED:', err.message);
  }

  // TEST 7: Timezone Invariance (Asia/Kolkata regardless of host device timezone)
  try {
    // An instant in UTC: 2026-10-18T05:00:00.000Z
    // In Asia/Kolkata (+05:30), this instant is EXACTLY 10:30 AM
    // On a 05:00 to 13:00 shift, at 10:30 AM, remaining time is 2h 30m.
    const utcRef = new Date('2026-10-18T05:00:00.000Z');
    const kolkataTime = getKolkataTime(utcRef);

    assert.strictEqual(kolkataTime.hours, 10, 'Kolkata hour must be 10');
    assert.strictEqual(kolkataTime.minutes, 30, 'Kolkata minutes must be 30');

    const status = calculateShiftStatus({
      shift_name: 'Morning Shift',
      shift_start: '05:00',
      shift_end: '13:00',
      refDate: utcRef
    });

    assert.strictEqual(status.statusText, 'On shift · 2h 30m left');

    console.log('✓ TEST 7 PASSED: Shift calculations are strictly anchored in Asia/Kolkata independent of system timezone');
    passed++;
  } catch (err) {
    console.error('✗ TEST 7 FAILED:', err.message);
  }

  // TEST 8: Shift Policy Enforcement on Login (Allowed vs Blocked)
  try {
    const testEmail = `shift.policy.test${Date.now()}@crumbco.com`;
    // Onboard a baker with a past shift (01:00 to 04:00) so current time is outside shift
    const onboard = await workerRepository.onboardWorker({
      businessId: 1,
      name: 'Shift Policy Tester',
      email: testEmail,
      role: 'baker',
      shift_name: 'Dawn Deck',
      shift_start: '01:00',
      shift_end: '04:00',
      dailyWage: 1200
    });

    // 1) When block_out_of_shift_login = 0 (default allowed):
    await db.query('UPDATE businesses SET block_out_of_shift_login = 0 WHERE id = 1');
    const loginAllowed = await authService.loginUser({
      identifier: testEmail,
      password: onboard.temporary_password
    });
    assert.ok(loginAllowed.token, 'Login must succeed when policy allows out-of-shift login');
    assert.strictEqual(loginAllowed.user.is_outside_shift, true, 'is_outside_shift flag must be true');
    assert.ok(loginAllowed.server_time, 'server_time must be returned');

    // 2) When block_out_of_shift_login = 1 (blocked):
    await db.query('UPDATE businesses SET block_out_of_shift_login = 1 WHERE id = 1');
    let blockedError = null;
    try {
      await authService.loginUser({
        identifier: testEmail,
        password: onboard.temporary_password
      });
    } catch (e) {
      blockedError = e;
    }

    assert.ok(blockedError, 'Login must fail when policy blocks out-of-shift login');
    assert.strictEqual(blockedError.code, 'SHIFT_RESTRICTED');
    assert.strictEqual(blockedError.statusCode, 403);

    // Reset policy back to default (0)
    await db.query('UPDATE businesses SET block_out_of_shift_login = 0 WHERE id = 1');

    console.log('✓ TEST 8 PASSED: Shift policy blocking out-of-shift login strictly enforced with 403 SHIFT_RESTRICTED');
    passed++;
  } catch (err) {
    console.error('✗ TEST 8 FAILED:', err.message);
  }

  // TEST 9: Dashboard Floor Count (Active staff on floor counts only clocked in & on-shift bakers)
  try {
    const summary = await ownerRepository.getDashboardSummary(1);
    assert.ok(typeof summary.active_staff_on_floor === 'number', 'active_staff_on_floor must be a number');

    const att = await workerRepository.getAttendanceSummary(1);
    assert.strictEqual(summary.active_staff_on_floor, att.activeStaffOnFloor);

    console.log(`✓ TEST 9 PASSED: Active staff on floor (${summary.active_staff_on_floor}) counts only clocked-in & on-shift workers`);
    passed++;
  } catch (err) {
    console.error('✗ TEST 9 FAILED:', err.message);
  }

  console.log(`\n======================================================`);
  console.log(` BAKER SHIFT TIMER RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runBakerShiftTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
