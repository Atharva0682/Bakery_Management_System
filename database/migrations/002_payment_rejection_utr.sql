-- Migration 002: Add Rejected Payment & Order Lifecycle and UTR Constraints
-- Supports terminal 'Rejected' state for payments and orders, and partial unique index on UPI UTR.

-- 1. Add columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 2. Add columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- 3. Unique Index for QR_UPI reference codes per business (prevent duplicate UTR recycling)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_business_utr 
ON payments (business_id, qr_reference_code) 
WHERE payment_mode = 'QR_UPI' AND qr_reference_code IS NOT NULL;
