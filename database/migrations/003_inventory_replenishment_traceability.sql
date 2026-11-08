-- ==============================================================================
-- MIGRATION 003: INVENTORY REPLENISHMENT, NOTIFICATIONS & BATCH TRACEABILITY
-- Crumb & Co. Smart Bakery Management System
-- ==============================================================================

-- 1. Migration History Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(120) PRIMARY KEY,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Standardize Initial Ingredient Baseline (One-time migration)
-- Every kg-based ingredient: 50 kg
-- Every litre-based ingredient: 50 L
-- Count-based units (pcs, eggs, etc.): preserved intact
UPDATE raw_materials
SET current_stock = 50.00,
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(unit) = 'kg';

UPDATE raw_materials
SET current_stock = 50.00,
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(unit) IN ('l', 'litre', 'litres', 'liter');

-- Also keep minimum_stock and min_reorder_level strictly in sync
UPDATE raw_materials
SET minimum_stock = min_reorder_level
WHERE minimum_stock != min_reorder_level;

-- 3. Batch Ingredient Consumption Table (Full Recipe & Lot Traceability)
CREATE TABLE IF NOT EXISTS batch_ingredient_consumption (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    batch_id INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    raw_material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(150) NOT NULL,
    recipe_required_qty NUMERIC(10, 3) NOT NULL,
    actual_consumed_qty NUMERIC(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    difference NUMERIC(10, 3) DEFAULT 0.000,
    stock_before NUMERIC(10, 3),
    stock_after NUMERIC(10, 3),
    lot_id INT REFERENCES raw_material_lots(id) ON DELETE SET NULL,
    lot_number VARCHAR(100),
    movement_id INT REFERENCES stock_movements(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batch_ing_consumption_batch ON batch_ingredient_consumption(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_ing_consumption_material ON batch_ingredient_consumption(raw_material_id);

-- 4. Stock Notifications Table (Centralized, Deduplicated & Auto-Resolving)
CREATE TABLE IF NOT EXISTS stock_notifications (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    raw_material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(150) NOT NULL,
    available_stock NUMERIC(10, 3) NOT NULL,
    minimum_threshold NUMERIC(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    stock_status VARCHAR(50) NOT NULL CHECK(stock_status IN ('LOW STOCK', 'OUT OF STOCK')),
    severity VARCHAR(20) NOT NULL CHECK(severity IN ('warning', 'critical')),
    message TEXT NOT NULL,
    is_resolved INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_stock_notifications_active ON stock_notifications(business_id, is_resolved);

-- 5. Enhanced Columns on Existing Tables
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS actual_baked_qty INT DEFAULT 0;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS accepted_quantity INT DEFAULT 0;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS rejected_quantity INT DEFAULT 0;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS packaging_status VARCHAR(50) DEFAULT 'Pending';

ALTER TABLE quality_checks ADD COLUMN IF NOT EXISTS inspector_name VARCHAR(100);
ALTER TABLE quality_checks ADD COLUMN IF NOT EXISTS accepted_quantity INT DEFAULT 0;
ALTER TABLE quality_checks ADD COLUMN IF NOT EXISTS rejected_quantity INT DEFAULT 0;
ALTER TABLE quality_checks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE quality_checks ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE quality_checks ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE stock_requisitions ADD COLUMN IF NOT EXISTS ingredient_name VARCHAR(150);
ALTER TABLE stock_requisitions ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(10, 2);
ALTER TABLE stock_requisitions ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE stock_requisitions ADD COLUMN IF NOT EXISTS received_by INT REFERENCES users(id);
ALTER TABLE stock_requisitions ADD COLUMN IF NOT EXISTS replenishment_notes TEXT;

-- Record this migration in schema_migrations
INSERT INTO schema_migrations (name) VALUES ('003_inventory_replenishment_traceability') ON CONFLICT DO NOTHING;

