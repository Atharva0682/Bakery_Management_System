const fs = require('fs');
const path = require('path');
const db = require('../config/db');

class ScreenshotRetentionService {
  constructor() {
    this.intervalId = null;
    this.isPurging = false;
  }

  /**
   * Validate image format and file size
   * Acceptable: JPG, JPEG, PNG, WebP
   * Max Size: 8 MB
   */
  validateScreenshot(dataUrlOrBuffer) {
    if (!dataUrlOrBuffer) {
      throw new Error('Screenshot data is required.');
    }

    if (typeof dataUrlOrBuffer === 'string') {
      // Base64 data URL
      const matches = dataUrlOrBuffer.match(/^data:image\/(jpeg|jpg|png|webp);base64,/i);
      if (!matches && !dataUrlOrBuffer.startsWith('http://') && !dataUrlOrBuffer.startsWith('https://') && !dataUrlOrBuffer.startsWith('/uploads/')) {
        const err = new Error('Invalid file format. Only JPG, JPEG, PNG, and WebP payment screenshots are accepted.');
        err.code = 'INVALID_FILE_TYPE';
        err.statusCode = 400;
        throw err;
      }

      // Check size
      if (matches) {
        const base64Data = dataUrlOrBuffer.replace(/^data:image\/\w+;base64,/, '');
        const sizeInBytes = (base64Data.length * 3) / 4;
        const maxBytes = 8 * 1024 * 1024; // 8MB
        if (sizeInBytes > maxBytes) {
          const err = new Error('Payment screenshot exceeds the 8MB maximum upload limit.');
          err.code = 'FILE_TOO_LARGE';
          err.statusCode = 400;
          throw err;
        }
      }
    }
    return true;
  }

  /**
   * Automatically deletes payment screenshots older than retention period (default 30 days).
   * CRITICAL SAFEGUARD:
   * - Deletes ONLY the screenshot file and associated file data/metadata.
   * - NEVER deletes the order, payment record, amount, verification status, or audit trail!
   * - Idempotent, handles missing files gracefully, logs results.
   * 
   * @param {number} retentionDays - Number of days retention (default 30)
   * @returns {Promise<{ cleanedCount: number, timestamp: string }>}
   */
  async cleanExpiredScreenshots(retentionDays = 30) {
    if (this.isPurging) return { cleanedCount: 0, status: 'already_running' };
    this.isPurging = true;

    try {
      // Find payments where screenshot exists and uploaded_at is older than retentionDays
      // We check screenshot_uploaded_at (or fallback to created_at if uploaded_at is null)
      const query = `
        SELECT id, order_id, screenshot_data, screenshot_uploaded_at, created_at, amount_paid, status
        FROM payments
        WHERE screenshot_data IS NOT NULL
          AND (
            screenshot_uploaded_at < datetime('now', '-' || $1 || ' days')
            OR (screenshot_uploaded_at IS NULL AND created_at < datetime('now', '-' || $1 || ' days'))
          )
      `;

      const result = await db.query(query, [retentionDays]);
      const expiredPayments = result.rows || [];

      let purgedCount = 0;

      for (const payment of expiredPayments) {
        try {
          const screenshotVal = payment.screenshot_data;

          // If it was stored as a local filesystem file path (e.g. /uploads/ss-123.png)
          if (typeof screenshotVal === 'string' && (screenshotVal.startsWith('/') || screenshotVal.startsWith('uploads'))) {
            const absolutePath = path.isAbsolute(screenshotVal) 
              ? screenshotVal 
              : path.join(__dirname, '../../public', screenshotVal);

            if (fs.existsSync(absolutePath)) {
              try {
                fs.unlinkSync(absolutePath);
                console.log(`[ScreenshotRetention] Unlinked file from disk: ${absolutePath}`);
              } catch (unlinkErr) {
                console.warn(`[ScreenshotRetention] Could not unlink ${absolutePath}:`, unlinkErr.message);
              }
            }
          }

          // Clear ONLY screenshot_data column in the payment record!
          // PRESERVE payment.id, order_id, amount_paid, status, verified_by, verified_at, rejection_reason!
          await db.query(
            `UPDATE payments 
             SET screenshot_data = NULL 
             WHERE id = $1`,
            [payment.id]
          );

          purgedCount++;
        } catch (itemErr) {
          console.error(`[ScreenshotRetention] Error cleaning screenshot for payment #${payment.id}:`, itemErr.message);
        }
      }

      if (purgedCount > 0) {
        console.log(`[ScreenshotRetention] Successfully purged ${purgedCount} expired payment screenshots (Retention policy: ${retentionDays} days). Orders and payment audit records preserved.`);
      }

      return {
        cleanedCount: purgedCount,
        timestamp: new Date().toISOString(),
        retentionDays
      };
    } catch (err) {
      console.error('[ScreenshotRetention] Cleanup error:', err.message);
      return { cleanedCount: 0, error: err.message };
    } finally {
      this.isPurging = false;
    }
  }

  /**
   * Start recurring background scheduler (runs hourly)
   */
  startScheduler() {
    if (this.intervalId) return;

    // Run once on startup
    this.cleanExpiredScreenshots(30).catch(err => {
      console.warn('[ScreenshotRetention] Initial startup cleanup warning:', err.message);
    });

    // Run every hour (3600000 ms)
    this.intervalId = setInterval(() => {
      this.cleanExpiredScreenshots(30).catch(err => {
        console.warn('[ScreenshotRetention] Hourly cleanup warning:', err.message);
      });
    }, 60 * 60 * 1000);

    console.log('[ScreenshotRetention] Background 30-day screenshot auto-deletion worker scheduled (Hourly).');
  }

  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = new ScreenshotRetentionService();
