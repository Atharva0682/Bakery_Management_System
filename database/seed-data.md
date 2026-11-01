# Multi-Tenant Seed & Verification Dataset

This document defines seed data for two independent bakery businesses (**Crumb & Co.** and **The French Loaf Bakery**) to test and verify multi-tenant isolation, role separation, and universal QR routing.

---

## 1. Businesses (Tenants)

```sql
INSERT INTO businesses (
    id, name, slug, logo_url, primary_color, secondary_color, accent_color, 
    currency, timezone, contact_email, contact_phone, 
    address_line1, city, postal_code, state, country, fssai_license, upi_vpa
) VALUES 
-- Business 1: Crumb & Co.
(
    1, 'Crumb & Co.', 'crumbandco', '/assets/logos/crumbandco.svg', 
    '#5A3825', '#8B5A2B', '#D96C8A', 'INR', 'Asia/Kolkata', 
    'order@crumbandco.in', '+91 98765 43210', 
    'Flat 402, Sea Breeze, Carter Road, Bandra West', 'Mumbai', '400050', 'Maharashtra', 'India', 
    '12245087001234', 'crumbandco@hdfcbank'
),
-- Business 2: The French Loaf Bakery
(
    2, 'The French Loaf Bakery', 'frenchloaf', '/assets/logos/frenchloaf.svg', 
    '#1E3A8A', '#2563EB', '#F59E0B', 'INR', 'Asia/Kolkata', 
    'contact@frenchloaf.com', '+91 98111 22334', 
    '15 Brigade Road, Ashok Nagar', 'Bengaluru', '560025', 'Karnataka', 'India', 
    '11223344556677', 'frenchloaf@icici'
);
```

---

## 2. Universal QR Codes (Scoped by `business_id`)

```sql
INSERT INTO qr_codes (business_id, qr_type, unique_code, target_url, location_tag) VALUES
-- Crumb & Co. QR Codes
(1, 'table_order', 'QR-CRUMB-TBL-01', '/b/crumbandco?table=1', 'Table 1 (Indoor)'),
(1, 'direct_payment', 'QR-CRUMB-PAY-COUNTER', '/b/crumbandco/checkout', 'Main Cashier Counter'),

-- The French Loaf QR Codes
(2, 'table_order', 'QR-FL-TBL-01', '/b/frenchloaf?table=1', 'Garden Table 1'),
(2, 'counter_pickup', 'QR-FL-PICKUP-01', '/b/frenchloaf/menu', 'Express Pickup Kiosk');
```

---

## 3. Users Scoped by Business & Role

```sql
-- Crumb & Co. (Business 1) Users
INSERT INTO users (id, business_id, name, email, phone, role, is_active) VALUES
(1, 1, 'Elena Vance', 'elena.owner@crumbandco.in', '+91-98201-00001', 'owner', true),
(2, 1, 'Marcus Brody', 'marcus.mgr@crumbandco.in', '+91-98201-00002', 'manager', true),
(3, 1, 'Chef Antonio Rossi', 'antonio.baker@crumbandco.in', '+91-98201-00003', 'baker', true),
(4, 1, 'Ananya Nair', 'ananya.customer@gmail.com', '+91-98201-54321', 'customer', true);

-- The French Loaf (Business 2) Users
INSERT INTO users (id, business_id, name, email, phone, role, is_active) VALUES
(10, 2, 'Pierre Dubois', 'pierre.owner@frenchloaf.com', '+91-98301-00010', 'owner', true),
(11, 2, 'Sophie Laurent', 'sophie.mgr@frenchloaf.com', '+91-98301-00011', 'manager', true),
(12, 2, 'Lucas Bernard', 'lucas.staff@frenchloaf.com', '+91-98301-00012', 'staff', true),
(13, 2, 'Vikram Mehta', 'vikram.customer@gmail.com', '+91-98301-54322', 'customer', true);
```

---

## 4. Product Catalog Scoped by Business

### Categories
```sql
-- Business 1
INSERT INTO categories (id, business_id, name, slug, description, display_order, is_active) VALUES
(1, 1, 'Artisan Breads', 'artisan-breads', 'Naturally fermented sourdoughs.', 1, true),
(2, 1, 'Viennoiserie & Pastries', 'pastries', 'Flaky butter pastries.', 2, true);

-- Business 2
INSERT INTO categories (id, business_id, name, slug, description, display_order, is_active) VALUES
(10, 2, 'French Baguettes', 'french-baguettes', 'Traditional crisp baguettes.', 1, true),
(11, 2, 'Gourmet Quiches', 'gourmet-quiches', 'Rich savory egg custard pies.', 2, true);
```

### Products & Variants
```sql
-- Business 1 Products
INSERT INTO products (id, business_id, category_id, name, slug, description, is_eggless, shelf_life_days, is_available) VALUES
(1, 1, 1, 'San Francisco Sourdough Loaf', 'san-francisco-sourdough', '36-hour slow fermented sourdough.', true, 4, true),
(2, 1, 2, 'Butter Croissant', 'butter-croissant', 'Flaky European cultured butter pastry.', false, 2, true);

INSERT INTO product_variants (id, product_id, name, sku, selling_price, is_default, is_available) VALUES
(1, 1, 'Standard 500g', 'CRUMB-SD-500', 180.00, true, true),
(2, 2, 'Single Piece', 'CRUMB-CR-SGL', 180.00, true, true);

-- Business 2 Products
INSERT INTO products (id, business_id, category_id, name, slug, description, is_eggless, shelf_life_days, is_available) VALUES
(10, 2, 10, 'Tradition Baguette Parisienne', 'tradition-baguette', 'Classic French crusty baguette with open airy crumb.', true, 2, true),
(11, 2, 11, 'Quiche Lorraine Smoked Bacon', 'quiche-lorraine', 'Classic savory pie with smoked bacon and gruyere.', false, 3, true);

INSERT INTO product_variants (id, product_id, name, sku, selling_price, is_default, is_available) VALUES
(10, 10, 'Full Baguette 300g', 'FL-BAG-300', 140.00, true, true),
(11, 11, 'Individual Slice', 'FL-QCH-SGL', 220.00, true, true);
```

---

## 5. Orders & Status History Scoped by Business

```sql
-- Crumb & Co. Order #1001
INSERT INTO orders (
    id, business_id, order_no, customer_id, order_type, order_status, 
    payment_status, payment_method, subtotal, delivery_fee, tax_amount, total_amount, estimated_ready_time
) VALUES (
    1, 1, 'ORD-CRUMB-1001', 4, 'delivery', 'In Production', 
    'Paid', 'QR_UPI', 360.00, 40.00, 18.00, 418.00, CURRENT_TIMESTAMP + INTERVAL '35 minutes'
);

INSERT INTO order_items (id, order_id, product_variant_id, batch_id, quantity, unit_price, subtotal) VALUES
(1, 1, 2, 1, 2, 180.00, 360.00);

-- The French Loaf Order #2001
INSERT INTO orders (
    id, business_id, order_no, customer_id, order_type, order_status, 
    payment_status, payment_method, subtotal, delivery_fee, tax_amount, total_amount, estimated_ready_time
) VALUES (
    10, 2, 'ORD-FL-2001', 13, 'pickup', 'Delivered', 
    'Paid', 'QR_UPI', 360.00, 0.00, 18.00, 378.00, CURRENT_TIMESTAMP - INTERVAL '1 hour'
);

INSERT INTO order_items (id, order_id, product_variant_id, batch_id, quantity, unit_price, subtotal) VALUES
(10, 10, 10, 10, 1, 140.00, 140.00),
(11, 10, 11, 10, 1, 220.00, 220.00);
```

---

## 6. Tenant-Isolation Verification Queries

Execute these queries to mathematically confirm complete tenant segregation:

```sql
-- 1. Verify Catalog Isolation: Business 1 must only return Crumb & Co. products
SELECT p.name AS product_name, c.name AS category_name, b.name AS business_name
FROM products p
JOIN categories c ON p.category_id = c.id
JOIN businesses b ON p.business_id = b.id
WHERE p.business_id = 1;

-- 2. Verify Order Isolation: Business 2 must only return French Loaf orders
SELECT o.order_no, o.total_amount, o.order_status, u.name AS customer_name, b.name AS business_name
FROM orders o
JOIN users u ON o.customer_id = u.id
JOIN businesses b ON o.business_id = b.id
WHERE o.business_id = 2;

-- 3. Verify Universal QR Resolution: Scanning QR returns the correct tenant & location
SELECT qr.unique_code, qr.qr_type, qr.location_tag, b.name AS business_name, b.upi_vpa
FROM qr_codes qr
JOIN businesses b ON qr.business_id = b.id
WHERE qr.unique_code = 'QR-CRUMB-TBL-01';
```
