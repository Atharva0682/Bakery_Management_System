-- ============================================================================
-- Migration: 001_multi_tenant_migration.sql
-- Description: Transforms single-tenant bakery database into a Universal Multi-Client / Multi-Tenant Platform
-- Database: PostgreSQL (ANSI standard DDL)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Businesses / Tenant Entity
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(80) UNIQUE NOT NULL,
    logo_url VARCHAR(255),
    primary_color VARCHAR(20) DEFAULT '#5A3825',
    secondary_color VARCHAR(20) DEFAULT '#8B5A2B',
    accent_color VARCHAR(20) DEFAULT '#D96C8A',
    currency VARCHAR(10) DEFAULT 'INR',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    contact_email VARCHAR(160) NOT NULL,
    contact_phone VARCHAR(25) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    fssai_license VARCHAR(50),
    upi_vpa VARCHAR(120),
    theme_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. Universal QR Codes Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_codes (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    qr_type VARCHAR(40) NOT NULL CHECK (qr_type IN ('table_order', 'counter_pickup', 'direct_payment', 'digital_menu', 'custom')),
    unique_code VARCHAR(100) UNIQUE NOT NULL,
    target_url VARCHAR(255) NOT NULL,
    location_tag VARCHAR(100), -- E.g. 'Table 1', 'Table 4', 'Main Counter'
    is_active BOOLEAN DEFAULT TRUE,
    scan_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 3. Enhance Users Table for Multi-Tenancy & Roles
-- ----------------------------------------------------------------------------
-- Add business_id to users if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='business_id'
    ) THEN
        ALTER TABLE users ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update role constraint to strictly support: customer, staff, baker, manager, owner
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('customer', 'staff', 'baker', 'manager', 'owner'));

-- ----------------------------------------------------------------------------
-- 4. Add business_id to All Operational Entities
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Customer addresses
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_addresses' AND column_name='business_id') THEN
        ALTER TABLE customer_addresses ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Categories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='business_id') THEN
        ALTER TABLE categories ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='business_id') THEN
        ALTER TABLE products ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Suppliers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='business_id') THEN
        ALTER TABLE suppliers ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Raw Materials
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raw_materials' AND column_name='business_id') THEN
        ALTER TABLE raw_materials ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Raw Material Lots (FIFO)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raw_material_lots' AND column_name='business_id') THEN
        ALTER TABLE raw_material_lots ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Recipes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recipes' AND column_name='business_id') THEN
        ALTER TABLE recipes ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Production Batches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='production_batches' AND column_name='business_id') THEN
        ALTER TABLE production_batches ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='business_id') THEN
        ALTER TABLE orders ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Payments
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='business_id') THEN
        ALTER TABLE payments ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Wastage Logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wastage_logs' AND column_name='business_id') THEN
        ALTER TABLE wastage_logs ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;

    -- Customer Feedback
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customer_feedback' AND column_name='business_id') THEN
        ALTER TABLE customer_feedback ADD COLUMN business_id INT REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Multi-Tenant Compound Unique Constraints & Indexes
-- ----------------------------------------------------------------------------
-- Scoped uniqueness per business
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_business_slug_key;
ALTER TABLE categories ADD CONSTRAINT categories_business_slug_key UNIQUE (business_id, slug);

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_slug_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_business_slug_key;
ALTER TABLE products ADD CONSTRAINT products_business_slug_key UNIQUE (business_id, slug);

ALTER TABLE production_batches DROP CONSTRAINT IF EXISTS production_batches_batch_no_key;
ALTER TABLE production_batches DROP CONSTRAINT IF EXISTS production_batches_business_batch_no_key;
ALTER TABLE production_batches ADD CONSTRAINT production_batches_business_batch_no_key UNIQUE (business_id, batch_no);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_no_key;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_business_order_no_key;
ALTER TABLE orders ADD CONSTRAINT orders_business_order_no_key UNIQUE (business_id, order_no);

-- Performance Indexes for Tenant Isolation Queries
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_qr_codes_business ON qr_codes(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(unique_code);
CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id, role);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id, is_available);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id, order_status);
CREATE INDEX IF NOT EXISTS idx_batches_business ON production_batches(business_id, status);
CREATE INDEX IF NOT EXISTS idx_raw_materials_business ON raw_materials(business_id);
CREATE INDEX IF NOT EXISTS idx_raw_material_lots_business ON raw_material_lots(business_id, material_id);
CREATE INDEX IF NOT EXISTS idx_feedback_business ON customer_feedback(business_id);

-- ----------------------------------------------------------------------------
-- 6. Seed Data for Two Independent Businesses (Tenant Isolation Verification)
-- ----------------------------------------------------------------------------

-- Business 1: Crumb & Co. (Demo Business A)
INSERT INTO businesses (
    id, name, slug, logo_url, primary_color, secondary_color, accent_color, 
    currency, timezone, contact_email, contact_phone, 
    address_line1, city, postal_code, state, country, fssai_license, upi_vpa
) VALUES (
    1, 'Crumb & Co.', 'crumbandco', '/assets/logos/crumbandco.svg', 
    '#5A3825', '#8B5A2B', '#D96C8A', 'INR', 'Asia/Kolkata', 
    'order@crumbandco.in', '+91 98765 43210', 
    'Flat 402, Sea Breeze, Carter Road, Bandra West', 'Mumbai', '400050', 'Maharashtra', 'India', 
    '12245087001234', 'crumbandco@hdfcbank'
) ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    currency = EXCLUDED.currency;

-- Business 2: The French Loaf Bakery (Demo Business B)
INSERT INTO businesses (
    id, name, slug, logo_url, primary_color, secondary_color, accent_color, 
    currency, timezone, contact_email, contact_phone, 
    address_line1, city, postal_code, state, country, fssai_license, upi_vpa
) VALUES (
    2, 'The French Loaf Bakery', 'frenchloaf', '/assets/logos/frenchloaf.svg', 
    '#1E3A8A', '#2563EB', '#F59E0B', 'INR', 'Asia/Kolkata', 
    'contact@frenchloaf.com', '+91 98111 22334', 
    '15 Brigade Road, Ashok Nagar', 'Bengaluru', '560025', 'Karnataka', 'India', 
    '11223344556677', 'frenchloaf@icici'
) ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    currency = EXCLUDED.currency;

-- Adjust sequence if needed
SELECT setval('businesses_id_seq', (SELECT MAX(id) FROM businesses));

-- QR Codes for Business 1
INSERT INTO qr_codes (business_id, qr_type, unique_code, target_url, location_tag) VALUES
(1, 'table_order', 'QR-CRUMB-TBL-01', '/b/crumbandco?table=1', 'Table 1 (Indoor)'),
(1, 'direct_payment', 'QR-CRUMB-PAY-COUNTER', '/b/crumbandco/checkout', 'Main Cashier Counter')
ON CONFLICT (unique_code) DO NOTHING;

-- QR Codes for Business 2
INSERT INTO qr_codes (business_id, qr_type, unique_code, target_url, location_tag) VALUES
(2, 'table_order', 'QR-FL-TBL-01', '/b/frenchloaf?table=1', 'Garden Table 1'),
(2, 'counter_pickup', 'QR-FL-PICKUP-01', '/b/frenchloaf/menu', 'Express Pickup Kiosk')
ON CONFLICT (unique_code) DO NOTHING;

-- Users for Business 1 (Crumb & Co.)
INSERT INTO users (id, business_id, name, email, phone, role, is_active) VALUES
(1, 1, 'Elena Vance', 'elena.owner@crumbandco.in', '+91-98201-00001', 'owner', true),
(2, 1, 'Marcus Brody', 'marcus.mgr@crumbandco.in', '+91-98201-00002', 'manager', true),
(3, 1, 'Chef Antonio Rossi', 'antonio.baker@crumbandco.in', '+91-98201-00003', 'baker', true),
(4, 1, 'Ananya Nair', 'ananya.customer@gmail.com', '+91-98201-54321', 'customer', true)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id, role = EXCLUDED.role;

-- Users for Business 2 (The French Loaf)
INSERT INTO users (id, business_id, name, email, phone, role, is_active) VALUES
(10, 2, 'Pierre Dubois', 'pierre.owner@frenchloaf.com', '+91-98301-00010', 'owner', true),
(11, 2, 'Sophie Laurent', 'sophie.mgr@frenchloaf.com', '+91-98301-00011', 'manager', true),
(12, 2, 'Lucas Bernard', 'lucas.baker@frenchloaf.com', '+91-98301-00012', 'staff', true),
(13, 2, 'Vikram Mehta', 'vikram.customer@gmail.com', '+91-98301-54322', 'customer', true)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id, role = EXCLUDED.role;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Categories for Business 1
INSERT INTO categories (id, business_id, name, slug, description, display_order, is_active) VALUES
(1, 1, 'Artisan Breads', 'artisan-breads', 'Naturally fermented sourdoughs.', 1, true),
(2, 1, 'Viennoiserie & Pastries', 'pastries', 'Flaky butter pastries.', 2, true)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

-- Categories for Business 2
INSERT INTO categories (id, business_id, name, slug, description, display_order, is_active) VALUES
(10, 2, 'French Baguettes', 'french-baguettes', 'Traditional crisp baguettes.', 1, true),
(11, 2, 'Gourmet Quiches', 'gourmet-quiches', 'Rich savory egg custard pies.', 2, true)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- Products for Business 1 (Crumb & Co.)
INSERT INTO products (id, business_id, category_id, name, slug, description, is_eggless, shelf_life_days, is_available) VALUES
(1, 1, 1, 'San Francisco Sourdough Loaf', 'san-francisco-sourdough', '36-hour slow fermented sourdough.', true, 4, true),
(2, 1, 2, 'Butter Croissant', 'butter-croissant', 'Flaky European cultured butter pastry.', false, 2, true)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

-- Products for Business 2 (The French Loaf)
INSERT INTO products (id, business_id, category_id, name, slug, description, is_eggless, shelf_life_days, is_available) VALUES
(10, 2, 10, 'Tradition Baguette Parisienne', 'tradition-baguette', 'Classic French crusty baguette with open airy crumb.', true, 2, true),
(11, 2, 11, 'Quiche Lorraine Smoked Bacon', 'quiche-lorraine', 'Classic savory pie with smoked bacon and gruyere.', false, 3, true)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- Product Variants for Business 1
INSERT INTO product_variants (id, product_id, name, sku, selling_price, is_default, is_available) VALUES
(1, 1, 'Standard 500g', 'CRUMB-SD-500', 180.00, true, true),
(2, 2, 'Single Piece', 'CRUMB-CR-SGL', 180.00, true, true)
ON CONFLICT (id) DO UPDATE SET selling_price = EXCLUDED.selling_price;

-- Product Variants for Business 2
INSERT INTO product_variants (id, product_id, name, sku, selling_price, is_default, is_available) VALUES
(10, 10, 'Full Baguette 300g', 'FL-BAG-300', 140.00, true, true),
(11, 11, 'Individual Slice', 'FL-QCH-SGL', 220.00, true, true)
ON CONFLICT (id) DO UPDATE SET selling_price = EXCLUDED.selling_price;

SELECT setval('product_variants_id_seq', (SELECT MAX(id) FROM product_variants));

-- Production Batches for Business 1
INSERT INTO production_batches (id, business_id, batch_no, status, planned_quantity, actual_usable_qty, scheduled_start) VALUES
(1, 1, 'BATCH-CRUMB-20261003-001', 'In Production', 50, 48, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

-- Production Batches for Business 2
INSERT INTO production_batches (id, business_id, batch_no, status, planned_quantity, actual_usable_qty, scheduled_start) VALUES
(10, 2, 'BATCH-FL-20261003-001', 'Completed', 40, 40, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

SELECT setval('production_batches_id_seq', (SELECT MAX(id) FROM production_batches));

-- Orders for Business 1 (Crumb & Co.)
INSERT INTO orders (
    id, business_id, order_no, customer_id, order_type, order_status, 
    payment_status, payment_method, subtotal, delivery_fee, tax_amount, total_amount, estimated_ready_time
) VALUES (
    1, 1, 'ORD-CRUMB-1001', 4, 'delivery', 'In Production', 
    'Paid', 'QR_UPI', 360.00, 40.00, 18.00, 418.00, CURRENT_TIMESTAMP + INTERVAL '35 minutes'
) ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

-- Orders for Business 2 (The French Loaf)
INSERT INTO orders (
    id, business_id, order_no, customer_id, order_type, order_status, 
    payment_status, payment_method, subtotal, delivery_fee, tax_amount, total_amount, estimated_ready_time
) VALUES (
    10, 2, 'ORD-FL-2001', 13, 'pickup', 'Delivered', 
    'Paid', 'QR_UPI', 360.00, 0.00, 18.00, 378.00, CURRENT_TIMESTAMP - INTERVAL '1 hour'
) ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));

-- Order Items for Business 1
INSERT INTO order_items (id, order_id, product_variant_id, batch_id, quantity, unit_price, subtotal) VALUES
(1, 1, 2, 1, 2, 180.00, 360.00)
ON CONFLICT (id) DO NOTHING;

-- Order Items for Business 2
INSERT INTO order_items (id, order_id, product_variant_id, batch_id, quantity, unit_price, subtotal) VALUES
(10, 10, 10, 10, 1, 140.00, 140.00),
(11, 10, 11, 10, 1, 220.00, 220.00)
ON CONFLICT (id) DO NOTHING;

SELECT setval('order_items_id_seq', (SELECT MAX(id) FROM order_items));

-- Order Status History for Business 1
INSERT INTO order_status_history (id, order_id, status, notes) VALUES
(1, 1, 'Order Placed', 'Customer placed order via PWA table QR'),
(2, 1, 'In Production', 'Antonio Rossi commenced baking')
ON CONFLICT (id) DO NOTHING;

-- Order Status History for Business 2
INSERT INTO order_status_history (id, order_id, status, notes) VALUES
(10, 10, 'Order Placed', 'Customer ordered for express pickup'),
(11, 10, 'Delivered', 'Customer collected at counter')
ON CONFLICT (id) DO NOTHING;

SELECT setval('order_status_history_id_seq', (SELECT MAX(id) FROM order_status_history));

-- Payments for Business 1 & 2
INSERT INTO payments (id, business_id, order_id, payment_mode, qr_reference_code, amount_paid, status) VALUES
(1, 1, 1, 'QR_UPI', 'UPI-UTR-CRUMB-99120', 418.00, 'Verified'),
(10, 2, 10, 'QR_UPI', 'UPI-UTR-FL-88319', 378.00, 'Verified')
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

SELECT setval('payments_id_seq', (SELECT MAX(id) FROM payments));

-- Customer Feedback for Business 1 & 2
INSERT INTO customer_feedback (id, business_id, order_id, user_id, batch_id, rating_overall, comment, is_complaint) VALUES
(1, 1, 1, 4, 1, 5, 'The sourdough and croissants are exceptionally crisp!', false),
(10, 2, 10, 13, 10, 5, 'Authentic Parisian crust on the baguette. Outstanding.', false)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

SELECT setval('customer_feedback_id_seq', (SELECT MAX(id) FROM customer_feedback));

COMMIT;
