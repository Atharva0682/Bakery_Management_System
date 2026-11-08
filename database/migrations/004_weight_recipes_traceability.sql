-- ==============================================================================
-- MIGRATION 004: WEIGHT-BASED RECIPES, PRODUCTION CALIBRATION & BATCH ALLOCATION
-- Crumb & Co. Smart Bakery Management System
-- ==============================================================================

-- 1. Recipes Weight & Calibration Fields
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS batch_output_weight NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS batch_output_weight_unit VARCHAR(20) DEFAULT 'g';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS standard_unit_weight_grams NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS expected_yield_percent NUMERIC(5,2) DEFAULT 100.00;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS production_wastage_percent NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS batch_identifier VARCHAR(100) DEFAULT NULL;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS selling_method VARCHAR(20) DEFAULT 'piece';

-- 2. Products Weight Fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_method VARCHAR(20) DEFAULT 'piece';
ALTER TABLE products ADD COLUMN IF NOT EXISTS standard_weight_grams NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(20) DEFAULT 'g';
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC(10,2) DEFAULT NULL;

-- 3. Product Variants Weight Field
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(10,2) DEFAULT NULL;

-- 4. Production Batches Weight & Planning Fields
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS actual_output_weight NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS output_weight_unit VARCHAR(20) DEFAULT 'g';
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS planned_weight NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS planned_weight_unit VARCHAR(20) DEFAULT 'g';
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS selling_method VARCHAR(20) DEFAULT 'piece';
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS is_planned INTEGER DEFAULT 0;

-- 5. Batch Orders Customer Allocation & Weight Fields
ALTER TABLE batch_orders ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE batch_orders ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(20) DEFAULT 'g';
ALTER TABLE batch_orders ADD COLUMN IF NOT EXISTS allocated_quantity NUMERIC(10,2) DEFAULT 1;
ALTER TABLE batch_orders ADD COLUMN IF NOT EXISTS delivered_quantity NUMERIC(10,2) DEFAULT 0;
ALTER TABLE batch_orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Allocated';
ALTER TABLE batch_orders ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 6. Order Items Weight & Selling Method Fields
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(20) DEFAULT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selling_method VARCHAR(20) DEFAULT 'piece';

-- Record migration
INSERT INTO schema_migrations (name) 
VALUES ('004_weight_recipes_traceability')
ON CONFLICT (name) DO NOTHING;

