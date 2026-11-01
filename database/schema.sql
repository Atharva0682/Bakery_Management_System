-- ============================================================================
-- Crumb & Co. - Universal Smart Bakery Management Platform Schema
-- Database: PostgreSQL (ANSI standard DDL)
-- Target Database Name: bakery_db
-- ============================================================================

DROP TABLE IF EXISTS customer_feedback CASCADE;
DROP TABLE IF EXISTS quality_checks CASCADE;
DROP TABLE IF EXISTS wastage_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS batch_orders CASCADE;
DROP TABLE IF EXISTS batch_workers CASCADE;
DROP TABLE IF EXISTS batch_materials_consumed CASCADE;
DROP TABLE IF EXISTS production_logs CASCADE;
DROP TABLE IF EXISTS production_batches CASCADE;
DROP TABLE IF EXISTS stock_requisitions CASCADE;
DROP TABLE IF EXISTS raw_material_lots CASCADE;
DROP TABLE IF EXISTS raw_materials CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS qr_codes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;

-- 1. Businesses / Tenants
CREATE TABLE businesses (
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

-- 2. Users (RBAC: customer, staff, baker, manager, owner)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) UNIQUE,
    phone VARCHAR(25) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('customer', 'staff', 'baker', 'manager', 'owner')),
    shift VARCHAR(60),
    shift_name VARCHAR(80),
    shift_start VARCHAR(10),
    shift_end VARCHAR(10),
    is_clocked_in BOOLEAN DEFAULT FALSE,
    crumb_points INT DEFAULT 0,
    hourly_rate NUMERIC(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. QR Codes
CREATE TABLE qr_codes (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    qr_type VARCHAR(40) NOT NULL CHECK (qr_type IN ('table_order', 'counter_pickup', 'direct_payment', 'digital_menu', 'custom')),
    unique_code VARCHAR(100) UNIQUE NOT NULL,
    target_url VARCHAR(255) NOT NULL,
    location_tag VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    scan_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Customer Addresses
CREATE TABLE customer_addresses (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) DEFAULT 'Home',
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    contact_phone VARCHAR(25),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(business_id, slug)
);

-- 6. Products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    is_eggless BOOLEAN DEFAULT FALSE,
    shelf_life_days INT DEFAULT 2,
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) DEFAULT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, slug)
);

-- 7. Product Variants
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sku VARCHAR(80),
    selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
    is_default BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE
);

-- 8. Suppliers
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(25),
    email VARCHAR(160),
    rating NUMERIC(3, 1) DEFAULT 5.0,
    gstin VARCHAR(25),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Raw Materials
CREATE TABLE raw_materials (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(20) NOT NULL,
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 10.00,
    cost_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Raw Material Lots (FIFO)
CREATE TABLE raw_material_lots (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    raw_material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
    lot_number VARCHAR(100) NOT NULL,
    quantity_received NUMERIC(12, 2) NOT NULL,
    quantity_remaining NUMERIC(12, 2) NOT NULL CHECK (quantity_remaining >= 0),
    unit_cost NUMERIC(10, 2) NOT NULL,
    expiry_date DATE,
    received_date DATE DEFAULT CURRENT_DATE
);

-- 11. Stock Requisitions
CREATE TABLE stock_requisitions (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    raw_material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    requested_by INT REFERENCES users(id) ON DELETE SET NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    notes TEXT,
    request_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Recipes
CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    yield_quantity INT NOT NULL DEFAULT 1,
    yield_unit VARCHAR(50) DEFAULT 'pcs',
    prep_time_minutes INT DEFAULT 60,
    bake_time_minutes INT DEFAULT 30,
    instructions TEXT
);

-- 13. Recipe Ingredients
CREATE TABLE recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    raw_material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    quantity_required NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL
);

-- 14. Production Batches
CREATE TABLE production_batches (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    batch_no VARCHAR(80) NOT NULL,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    baker_id INT REFERENCES users(id) ON DELETE SET NULL,
    planned_quantity INT NOT NULL CHECK (planned_quantity > 0),
    completed_quantity INT NOT NULL DEFAULT 0,
    actual_usable_qty INT NOT NULL DEFAULT 0,
    wastage_quantity INT NOT NULL DEFAULT 0,
    packed_quantity INT NOT NULL DEFAULT 0,
    shift VARCHAR(60) DEFAULT 'Morning Shift',
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    status VARCHAR(50) NOT NULL DEFAULT 'Planned' CHECK (status IN (
        'Planned', 'Accepted', 'In Production', 'Quality Check', 'Packaged', 'Completed', 'Rejected'
    )),
    scheduled_start VARCHAR(50),
    total_material_cost NUMERIC(10, 2) DEFAULT 0.00,
    total_labor_cost NUMERIC(10, 2) DEFAULT 0.00,
    total_batch_cost NUMERIC(10, 2) DEFAULT 0.00,
    unit_production_cost NUMERIC(10, 2) DEFAULT 0.00,
    production_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, batch_no)
);

-- 15. Batch Workers (Assigned Staff & Labor Hours)
CREATE TABLE batch_workers (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    task_description VARCHAR(150) NOT NULL,
    hours_spent NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    labor_cost NUMERIC(10, 2) NOT NULL DEFAULT 100.00
);

-- 16. Batch Materials Consumed (FIFO Consumption Bridge)
CREATE TABLE batch_materials_consumed (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    raw_material_id INT NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    lot_id INT REFERENCES raw_material_lots(id) ON DELETE SET NULL,
    quantity_consumed NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_cost_at_time NUMERIC(10, 2) NOT NULL,
    subtotal_cost NUMERIC(10, 2) NOT NULL
);

-- 17. Production Logs (Batch Status Audit Trail)
CREATE TABLE production_logs (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    baker_id INT REFERENCES users(id) ON DELETE SET NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    completed_quantity INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_no VARCHAR(100) NOT NULL,
    customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_type VARCHAR(30) NOT NULL CHECK (order_type IN ('pickup', 'delivery', 'dine_in')),
    address_id INT REFERENCES customer_addresses(id) ON DELETE SET NULL,
    delivery_time_slot VARCHAR(80) DEFAULT 'Now (30-45 mins)',
    order_status VARCHAR(50) NOT NULL DEFAULT 'Order Placed' CHECK (order_status IN (
        'Order Placed', 'Accepted', 'In Production', 'Quality Check', 'Packaged', 'Out for Delivery', 'Delivered', 'Cancelled', 'Rejected'
    )),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN (
        'Unpaid', 'Pending Verification', 'Paid', 'Failed', 'Refunded', 'Rejected'
    )),
    payment_method VARCHAR(30) DEFAULT 'QR_UPI',
    subtotal NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    special_instructions TEXT,
    delivery_hero_name VARCHAR(100),
    delivery_hero_phone VARCHAR(25),
    estimated_ready_time TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    rejected_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, order_no)
);

-- 19. Order Items
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_variant_id INT REFERENCES product_variants(id) ON DELETE SET NULL,
    batch_id INT REFERENCES production_batches(id) ON DELETE SET NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- 20. Batch Orders (Junction for Batch to Source Orders)
CREATE TABLE batch_orders (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    order_reference VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1
);

-- 21. Order Status History
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. Payments
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_mode VARCHAR(30) NOT NULL,
    qr_reference_code VARCHAR(120),
    amount_paid NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending Verification' CHECK (status IN (
        'Pending Verification', 'Verified', 'Failed', 'Refunded', 'Rejected'
    )),
    verified_by INT REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. Wastage Logs
CREATE TABLE wastage_logs (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    batch_id INT REFERENCES production_batches(id) ON DELETE SET NULL,
    raw_material_id INT REFERENCES raw_materials(id) ON DELETE SET NULL,
    quantity_wasted NUMERIC(10, 2) NOT NULL CHECK (quantity_wasted > 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    reason VARCHAR(100) NOT NULL,
    notes TEXT,
    cost_loss NUMERIC(10, 2) DEFAULT 0.00,
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 24. Quality Checks
CREATE TABLE quality_checks (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    batch_id INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    inspector_id INT REFERENCES users(id) ON DELETE SET NULL,
    result VARCHAR(20) NOT NULL CHECK (result IN ('PASSED', 'FAILED')),
    quality_notes TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 25. Customer Feedback
CREATE TABLE customer_feedback (
    id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id INT REFERENCES production_batches(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    rating_overall INT CHECK (rating_overall BETWEEN 1 AND 5),
    taste_rating INT CHECK (taste_rating BETWEEN 1 AND 5),
    freshness_rating INT CHECK (freshness_rating BETWEEN 1 AND 5),
    packaging_rating INT CHECK (packaging_rating BETWEEN 1 AND 5),
    delivery_rating INT CHECK (delivery_rating BETWEEN 1 AND 5),
    comment TEXT,
    tags TEXT[],
    is_complaint BOOLEAN DEFAULT FALSE,
    category VARCHAR(50) DEFAULT 'General Feedback',
    status VARCHAR(50) DEFAULT 'Acknowledged',
    points_awarded INT DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Tenant Scoped Indexes
CREATE INDEX idx_users_business ON users(business_id, role);
CREATE INDEX idx_products_business ON products(business_id, is_available);
CREATE INDEX idx_batches_business ON production_batches(business_id, status);
CREATE INDEX idx_orders_business ON orders(business_id, order_status);
CREATE INDEX idx_raw_materials_business ON raw_materials(business_id);
CREATE INDEX idx_raw_material_lots_business ON raw_material_lots(business_id, raw_material_id);
CREATE INDEX idx_qr_codes_business ON qr_codes(business_id, unique_code);
CREATE INDEX idx_customer_feedback_business ON customer_feedback(business_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_batch_workers_batch ON batch_workers(batch_id);
CREATE INDEX idx_batch_materials_batch ON batch_materials_consumed(batch_id);
