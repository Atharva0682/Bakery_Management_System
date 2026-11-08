-- ==============================================================================
-- MIGRATION 005: PACK-BASED PRODUCT MANAGEMENT, WEIGHT PRODUCTION & ADVANCED COSTING
-- Crumb & Co. Smart Bakery Management System
-- ==============================================================================

-- 1. Products Packaging & Weight Fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_unit VARCHAR(50) DEFAULT 'per_piece';
ALTER TABLE products ADD COLUMN IF NOT EXISTS items_per_pack INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS packs_per_batch INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_pieces_per_batch INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_per_piece_g NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS net_weight_per_pack_g NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_cost_per_pack NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price_per_pack NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price_per_piece NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS standard_batch_weight_g NUMERIC(10,2) DEFAULT NULL;

-- 2. Recipes Packaging & Weight Fields
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS selling_unit VARCHAR(50) DEFAULT 'per_piece';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS items_per_pack INTEGER DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS packs_per_batch INTEGER DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS total_pieces_per_batch INTEGER DEFAULT 1;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS weight_per_piece_g NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS net_weight_per_pack_g NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS packaging_cost_per_pack NUMERIC(10,2) DEFAULT 0.00;

-- 3. Production Batches Weight, Yield & Packaging Metrics
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS target_weight NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS target_weight_unit VARCHAR(20) DEFAULT 'g';
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS raw_ingredient_weight_g NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS expected_yield_weight_g NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS actual_finished_weight_g NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS sellable_weight_g NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS wastage_weight_g NUMERIC(10,3) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS yield_percentage NUMERIC(5,2) DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS packs_produced INTEGER DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS items_per_pack INTEGER DEFAULT NULL;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS scaling_factor NUMERIC(10,4) DEFAULT 1.0;

-- 4. Order Items Packaging & Weight Display
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pack_quantity INTEGER DEFAULT 1;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS items_per_pack INTEGER DEFAULT 1;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS net_weight_display VARCHAR(100) DEFAULT NULL;

-- Record migration
INSERT INTO schema_migrations (name) 
VALUES ('005_weight_pack_costing_enhancements')
ON CONFLICT (name) DO NOTHING;

