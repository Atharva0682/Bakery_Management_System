-- ============================================================================
-- Crumb & Co. - Universal Smart Bakery Management Platform Seed Script
-- Realistic Development & Demo Dataset
-- Database: PostgreSQL (ANSI standard DDL)
-- Target Database: bakery_db
-- ============================================================================

-- 1. Businesses (Tenants)
INSERT INTO businesses (
    id, name, slug, logo_url, primary_color, secondary_color, accent_color, 
    currency, timezone, contact_email, contact_phone, 
    address_line1, address_line2, city, postal_code, state, country, fssai_license, upi_vpa
) VALUES (
    1, 'Crumb & Co.', 'crumbandco', '/assets/logos/crumbandco.svg', 
    '#5A3825', '#8B5A2B', '#D96C8A', 'INR', 'Asia/Kolkata', 
    'order@crumbandco.in', '+91 98765 43210', 
    'Flat 402, Sea Breeze, Carter Road', 'Opposite Cafe Basilico, Bandra West', 'Mumbai', '400050', 'Maharashtra', 'India', 
    '12245087001234', 'crumbandco@hdfcbank'
), (
    2, 'The French Loaf Bakery', 'frenchloaf', '/assets/logos/frenchloaf.svg', 
    '#1E3A8A', '#2563EB', '#F59E0B', 'INR', 'Asia/Kolkata', 
    'contact@frenchloaf.com', '+91 98111 22334', 
    '15 Brigade Road', 'Ashok Nagar', 'Bengaluru', '560025', 'Karnataka', 'India', 
    '11223344556677', 'frenchloaf@icici'
) ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    contact_email = EXCLUDED.contact_email;

-- 2. Users (RBAC)
-- Password for all seeded demo accounts is: Password@123
-- Valid bcrypt hash ($2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G)
INSERT INTO users (id, business_id, name, email, phone, password_hash, role, shift, crumb_points, hourly_rate) VALUES
-- Business 1: Owner, Managers & Staff/Bakers
(1, 1, 'Priya Sharma', 'priya.sharma@crumbco.com', '+91-98201-00001', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'owner', 'Morning Shift', 0, 0.00),
(2, 1, 'Elena Vance', 'elena.owner@crumbandco.in', '+91-98201-00002', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'owner', 'Morning Shift', 0, 0.00),
(3, 1, 'Marcus Brody', 'marcus.mgr@crumbandco.in', '+91-98201-00003', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'manager', 'Morning Shift', 0, 220.00),
(4, 1, 'Rajesh Kumar', 'rajesh.kumar@crumbco.com', '+91-98201-00004', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'baker', 'Morning Shift', 0, 150.00),
(5, 1, 'Chef Antonio Rossi', 'antonio.baker@crumbandco.in', '+91-98201-00005', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'baker', 'Morning Shift', 0, 180.00),
(6, 1, 'Suresh Patil', 'suresh.baker@crumbco.com', '+91-98201-00007', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'baker', 'Evening Shift', 0, 120.00),
(7, 1, 'Priya Nair', 'priya.qc@crumbco.com', '+91-98201-00008', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'staff', 'Morning Shift', 0, 120.00),
(8, 1, 'Ramesh Kumar', 'ramesh.delivery@crumbco.com', '+91-98201-00009', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'staff', 'Flexible Shift', 0, 100.00),

-- Business 1: Default Storefront Customer
(9, 1, 'Customer', 'customer@crumbco.com', '+91-98201-99993', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'customer', null, 0, 0.00),

-- Business 2: Tenant Isolation Accounts (The French Loaf)
(30, 2, 'Pierre Dubois', 'pierre.owner@frenchloaf.com', '+91-98301-00010', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'owner', 'Morning Shift', 0, 0.00),
(31, 2, 'Lucas Bernard', 'lucas.staff@frenchloaf.com', '+91-98301-00012', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'baker', 'Morning Shift', 0, 160.00),
(32, 2, 'Vikram Mehta', 'vikram.customer@gmail.com', '+91-98301-54322', '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G', 'customer', null, 500, 0.00)
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email, 
    phone = EXCLUDED.phone, 
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;

-- 3. QR Codes
INSERT INTO qr_codes (id, business_id, qr_type, unique_code, target_url, location_tag) VALUES
(1, 1, 'table_order', 'QR-CRUMB-TBL-01', '/b/crumbandco?table=1', 'Table 1 (Indoor Window)'),
(2, 1, 'table_order', 'QR-CRUMB-TBL-02', '/b/crumbandco?table=2', 'Table 2 (Indoor Center)'),
(3, 1, 'table_order', 'QR-CRUMB-TBL-03', '/b/crumbandco?table=3', 'Table 3 (Patio Garden)'),
(4, 1, 'table_order', 'QR-CRUMB-TBL-04', '/b/crumbandco?table=4', 'Table 4 (Patio Sea Facing)'),
(5, 1, 'table_order', 'QR-CRUMB-TBL-05', '/b/crumbandco?table=5', 'Table 5 (Mezzanine Lounge)'),
(6, 1, 'direct_payment', 'QR-CRUMB-PAY-COUNTER', '/b/crumbandco/checkout', 'Main Cashier Counter'),
(7, 1, 'counter_pickup', 'QR-CRUMB-PICKUP-EXPRESS', '/b/crumbandco/menu', 'Express Takeaway Counter'),
(8, 2, 'table_order', 'QR-FL-TBL-01', '/b/frenchloaf?table=1', 'Garden Table 1 (Bengaluru)')
ON CONFLICT (id) DO NOTHING;

-- 4. Customer Addresses (Clean - populated upon customer order placement)

-- 5. Categories
INSERT INTO categories (id, business_id, name, slug, description, display_order) VALUES
(1, 1, 'Artisan Breads', 'breads', 'Naturally fermented sourdough loaves, rustic baguettes, and deck-baked focaccia', 1),
(2, 1, 'Viennoiserie & Pastries', 'pastries', 'Flaky French butter croissants, pains au chocolat, and filled danishes', 2),
(3, 1, 'Artisanal Cakes', 'cakes', 'Deck-oven baked celebration cakes, rich gateaux, and classic teacakes', 3),
(4, 1, 'Savory Delights & Puffs', 'savory', 'Crisp spiced masala puffs, rolls, savory tarts, and quiches', 4),
(5, 1, 'Cookies, Biscuits & Khari', 'cookies', 'Melt-in-mouth nankhatai, flaky khari, and chocolate sea-salt cookies', 5),
(6, 1, 'Brownies & Teacakes', 'brownies-teacakes', 'Dense Belgian dark chocolate brownies and spiced fruit teacakes', 6),
(7, 1, 'Cold Brews & Beverages', 'beverages', 'Artisan cold brewed coffees, hot chocolate, and spiced cutting chai', 7),
(10, 2, 'French Baguettes', 'french-baguettes', 'Traditional crisp Parisian baguettes', 1),
(11, 2, 'Gourmet Quiches', 'gourmet-quiches', 'Rich savory egg and gruyere pies', 2)
ON CONFLICT (id) DO NOTHING;

-- 6. Products
INSERT INTO products (id, business_id, category_id, name, slug, description, image_url, is_eggless, shelf_life_days, base_price) VALUES
-- Breads
(1, 1, 1, 'San Francisco Sourdough Loaf', 'san-francisco-sourdough', '36-hour slow fermented artisan sourdough with a blistered caramel crust and tangy open crumb.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600', true, 4, 180.00),
(2, 1, 1, 'Multigrain Seeded Sourdough', 'multigrain-seeded-sourdough', 'Whole wheat loaf crusted with toasted flaxseed, sunflower seeds, pumpkin seeds, and rolled oats.', 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600', true, 4, 210.00),
(3, 1, 1, 'French Rustic Baguette', 'french-rustic-baguette', 'Classic French slender loaf with golden crispy crust and light, airy honeycomb interior.', 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600', true, 2, 140.00),
(4, 1, 1, 'Olive & Rosemary Focaccia', 'olive-rosemary-focaccia', 'Extra virgin olive oil dough dimpled with Kalamata olives, fresh rosemary, and sea salt flakes.', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600', true, 3, 160.00),

-- Pastries
(5, 1, 2, 'Butter Croissant', 'butter-croissant', 'Multi-layered flaky French pastry prepared with cultured 84% European butter, baked golden.', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600', false, 2, 180.00),
(6, 1, 2, 'Pain au Chocolat', 'pain-au-chocolat', 'Crisp butter puff pastry encasing two batons of intense 55% Valrhona dark chocolate.', 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=600', false, 2, 210.00),
(7, 1, 2, 'Almond Frangipane Croissant', 'almond-frangipane-croissant', 'Twice-baked croissant soaked in vanilla syrup, stuffed with rich almond frangipane cream and sliced almonds.', 'https://images.unsplash.com/photo-1623334044303-241021148842?w=600', false, 2, 240.00),
(8, 1, 2, 'Fresh Blueberry Danish', 'fresh-blueberry-danish', 'Square laminated pastry filled with vanilla bean pastry cream and a tart wild blueberry compote.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600', false, 2, 190.00),

-- Cakes
(9, 1, 3, 'Belgian Chocolate Truffle Cake', 'chocolate-truffle-cake', 'Layers of intense dark chocolate sponge filled with silken 70% dark Belgian chocolate ganache.', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600', true, 3, 850.00),
(10, 1, 3, 'Classic Red Velvet Cake', 'classic-red-velvet-cake', 'Moist crimson cocoa sponge layered with whipped Philadelphia cream cheese frosting.', 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600', false, 3, 800.00),
(11, 1, 3, 'New York Baked Cheesecake', 'new-york-baked-cheesecake', 'Dense, velvety smooth baked cream cheese filling over a buttery graham cracker crust.', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600', false, 4, 950.00),
(12, 1, 3, 'Traditional Parsi Mawa Cake', 'parsi-mawa-cake', 'Classic Bombay bakery dense sponge infused with fresh evaporated milk solids, cardamom, and nutmeg.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600', false, 4, 120.00),
(13, 1, 3, 'Alphonso Mango Mousse Cake', 'alphonso-mango-mousse-cake', 'Light vanilla sponge layered with Ratnagiri Alphonso mango puree mousse and mirror glaze.', 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600', true, 3, 900.00),

-- Savories
(14, 1, 4, 'Spiced Masala Potato Puff', 'masala-puff', 'Crisp puff pastry packed with aromatic cumin, green pea, and spiced potato filling.', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600', true, 1, 45.00),
(15, 1, 4, 'Paneer Tikka Puff Roll', 'paneer-tikka-puff', 'Tandoori marinated cottage cheese cubes with peppers folded in golden flaky pastry.', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', true, 1, 65.00),
(16, 1, 4, 'Mushroom & Thyme Quiche Tart', 'mushroom-thyme-quiche', 'Buttery shortcrust tart filled with sautéed button mushrooms, fresh thyme, and savory custard.', 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600', false, 2, 130.00),

-- Cookies & Biscuits
(17, 1, 5, 'Hand-Rolled Butter Khari Pack', 'khari-biscuit-pack', 'Golden layered puff biscuits baked crisp and light. Bandra’s favorite companion for cutting chai.', 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=600', true, 15, 120.00),
(18, 1, 5, 'Traditional Cardamom Nankhatai Pack', 'nankhatai-pack', 'Authentic spiced cardamom shortbread made with pure cow ghee that crumbles delicately at first bite.', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600', true, 20, 150.00),
(19, 1, 5, 'Double Dark Chocolate Sea Salt Cookies', 'dark-chocolate-sea-salt-cookies', 'Fudgy Dutch cocoa cookies studded with Belgian dark chocolate chips and finished with Maldon sea salt.', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600', true, 10, 180.00),

-- Brownies
(20, 1, 6, 'Fudgy Belgian Walnut Brownie', 'fudgy-walnut-brownie', 'Rich, chewy dark chocolate brownie loaded with toasted Kashmiri walnuts and a crackly crust.', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600', true, 5, 140.00),
(21, 1, 6, 'Salted Caramel Fudge Brownie', 'salted-caramel-brownie', 'Fudge brownie swirled with house-made sea salt caramel and dark chocolate callets.', 'https://images.unsplash.com/photo-1515037893149-de7f840978e2?w=600', true, 5, 150.00),

-- Beverages
(22, 1, 7, 'Artisan Cold Brew Vanilla Latte', 'cold-brew-vanilla-latte', '18-hour cold steeped Chikmagalur Arabica blend shaken with whole milk and Madagascar vanilla.', 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600', true, 2, 160.00),
(23, 1, 7, 'Spiced Masala Cutting Chai Flask', 'masala-chai-flask', 'Authentic Mumbai cutting chai brewed with fresh ginger, crushed cardamom, and whole spices (500ml).', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600', true, 1, 110.00),

-- Business 2 Products
(24, 2, 10, 'Tradition Baguette Parisienne', 'tradition-baguette', 'Classic French crusty baguette with open airy crumb.', 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600', true, 2, 140.00),
(25, 2, 11, 'Quiche Lorraine Smoked Bacon', 'quiche-lorraine', 'Classic savory pie with smoked bacon and gruyere.', 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600', false, 3, 220.00)
ON CONFLICT (id) DO NOTHING;

-- 7. Product Variants
INSERT INTO product_variants (id, product_id, name, sku, selling_price, is_default, is_available) VALUES
-- Sourdough
(1, 1, 'Standard 500g Loaf', 'CRUMB-SD-500', 180.00, true, true),
(2, 1, 'Large 1kg Family Loaf', 'CRUMB-SD-1KG', 340.00, false, true),
(3, 2, 'Standard 500g Loaf', 'CRUMB-SD-SEED-500', 210.00, true, true),
(4, 3, 'Single Baguette 300g', 'CRUMB-BAG-300', 140.00, true, true),
(5, 4, 'Standard Slab 400g', 'CRUMB-FOC-400', 160.00, true, true),

-- Croissants & Pastries
(6, 5, 'Single Croissant', 'CRUMB-CR-SGL', 180.00, true, true),
(7, 5, 'Box of 4 Croissants', 'CRUMB-CR-BX4', 680.00, false, true),
(8, 6, 'Single Pain au Chocolat', 'CRUMB-PAC-SGL', 210.00, true, true),
(9, 7, 'Single Almond Croissant', 'CRUMB-ALM-SGL', 240.00, true, true),
(10, 8, 'Single Blueberry Danish', 'CRUMB-DAN-SGL', 190.00, true, true),

-- Cakes
(11, 9, '500g Bento Cake', 'CRUMB-TRF-500', 850.00, true, true),
(12, 9, '1kg Celebration Cake', 'CRUMB-TRF-1KG', 1600.00, false, true),
(13, 9, '2kg Party Cake', 'CRUMB-TRF-2KG', 3000.00, false, true),
(14, 10, '500g Cake', 'CRUMB-RV-500', 800.00, true, true),
(15, 10, '1kg Cake', 'CRUMB-RV-1KG', 1500.00, false, true),
(16, 11, 'Individual Slice 150g', 'CRUMB-CHK-SLC', 260.00, false, true),
(17, 11, 'Whole 1kg Cheesecake', 'CRUMB-CHK-1KG', 1700.00, true, true),
(18, 12, 'Single Slice 100g', 'CRUMB-MAWA-100', 120.00, true, true),
(19, 12, 'Half-kg Loaf 500g', 'CRUMB-MAWA-500', 550.00, false, true),
(20, 13, '500g Mango Mousse', 'CRUMB-MNG-500', 900.00, true, true),

-- Savories
(21, 14, 'Single Masala Puff', 'CRUMB-PUFF-SGL', 45.00, true, true),
(22, 14, 'Pack of 4 Puffs', 'CRUMB-PUFF-PK4', 160.00, false, true),
(23, 15, 'Single Paneer Puff', 'CRUMB-PAN-SGL', 65.00, true, true),
(24, 16, 'Single Quiche Tart', 'CRUMB-QCH-SGL', 130.00, true, true),

-- Cookies & Brownies
(25, 17, 'Pack of 200g Khari', 'CRUMB-KHARI-200', 120.00, true, true),
(26, 18, 'Pack of 250g Nankhatai', 'CRUMB-NAN-250', 150.00, true, true),
(27, 19, 'Box of 6 Cookies', 'CRUMB-COOK-BX6', 180.00, true, true),
(28, 20, 'Single Brownie Square', 'CRUMB-BRW-SGL', 140.00, true, true),
(29, 20, 'Box of 4 Brownies', 'CRUMB-BRW-BX4', 520.00, false, true),
(30, 21, 'Single Caramel Brownie', 'CRUMB-CBRW-SGL', 150.00, true, true),

-- Beverages
(31, 22, 'Bottle 300ml', 'CRUMB-CB-300', 160.00, true, true),
(32, 23, 'Insulated Flask 500ml', 'CRUMB-CHAI-500', 110.00, true, true),

-- Business 2 Variants
(33, 24, 'Full Baguette 300g', 'FL-BAG-300', 140.00, true, true),
(34, 25, 'Individual Slice', 'FL-QCH-SGL', 220.00, true, true)
ON CONFLICT (id) DO NOTHING;

-- 8. Suppliers
INSERT INTO suppliers (id, business_id, name, contact_person, phone, email, rating, gstin) VALUES
(1, 1, 'Sharma Flour Mills', 'Rajesh Sharma', '+91-98201-11223', 'orders@sharmaflour.in', 4.8, '27AAACS1234F1Z1'),
(2, 1, 'Amul Dairy Co-operative', 'Vipul Patel', '+91-98201-33445', 'sales@amul.coop', 4.9, '24AAACA5566G1Z2'),
(3, 1, 'Valrhona Cocoa & Chocolate Imports', 'Jean-Marc Dubois', '+91-98201-55667', 'india@valrhona.com', 4.9, '27AAACV7788H1Z3'),
(4, 1, 'Deccan Spice & Essence Trading', 'M. K. Rao', '+91-98201-77889', 'supply@deccanspice.in', 4.7, '36AAACD9900J1Z4'),
(5, 1, 'Royal Eco Packaging Solutions', 'Sanjay Gupta', '+91-98201-99001', 'orders@royalpackaging.in', 4.6, '27AAACR1122K1Z5'),
(6, 1, 'Godrej Farm Fresh Eggs & Dairy', 'Sunil Godrej', '+91-98201-22334', 'dairy@godrejfarms.com', 4.8, '27AAACG3344L1Z6'),
(7, 1, 'SweetChem Organic Sugars Ltd', 'Nitin Kulkarni', '+91-98201-44556', 'sales@sweetchem.in', 4.7, '27AAACS5566M1Z7')
ON CONFLICT (id) DO NOTHING;

-- 9. Raw Materials / Inventory
INSERT INTO raw_materials (id, business_id, name, category, unit, current_stock, min_reorder_level, cost_per_unit) VALUES
(1, 1, 'Fine All Purpose Flour (Maida)', 'Key Flours & Powders', 'kg', 280.00, 100.00, 42.00),
(2, 1, 'Whole Wheat Flour (Atta)', 'Key Flours & Powders', 'kg', 160.00, 60.00, 48.00),
(3, 1, 'Organic Rye Flour', 'Key Flours & Powders', 'kg', 45.00, 20.00, 110.00),
(4, 1, 'Rich Cocoa Powder (Imported)', 'Chocolates & Cocoa', 'kg', 6.50, 10.00, 380.00),
(5, 1, 'Callebaut Dark Chocolate Callets 54.5%', 'Chocolates & Cocoa', 'kg', 18.00, 15.00, 750.00),
(6, 1, 'Belgian White Chocolate Chips', 'Chocolates & Cocoa', 'kg', 12.00, 10.00, 680.00),
(7, 1, 'Baking Powder (Double Acting)', 'Leavening & Additives', 'kg', 2.80, 4.00, 140.00),
(8, 1, 'Active Dry Yeast', 'Leavening & Additives', 'kg', 5.20, 6.00, 360.00),
(9, 1, 'Pure Cow Ghee', 'Dairy & Fats', 'L', 75.00, 40.00, 580.00),
(10, 1, 'Unsalted Table Butter Blocks (84%)', 'Dairy & Fats', 'kg', 4.50, 25.00, 440.00),
(11, 1, 'Fresh Whipped Cream (Coldroom)', 'Dairy & Fats', 'L', 42.00, 20.00, 210.00),
(12, 1, 'Whole Cow Milk (Pasteurized)', 'Dairy & Fats', 'L', 60.00, 30.00, 65.00),
(13, 1, 'Condensed Milk Cans', 'Dairy & Fats', 'pcs', 18.00, 10.00, 125.00),
(14, 1, 'Fresh Farm Eggs (Crate of 30)', 'Dairy & Fats', 'pcs', 180.00, 90.00, 7.50),
(15, 1, 'Granulated White Sugar', 'Sweeteners', 'kg', 190.00, 80.00, 44.00),
(16, 1, 'Icing Sugar (Fine Powdered)', 'Sweeteners', 'kg', 65.00, 30.00, 68.00),
(17, 1, 'Organic Brown Demerara Sugar', 'Sweeteners', 'kg', 40.00, 20.00, 95.00),
(18, 1, 'Fresh Cardamom (Elaichi)', 'Spices & Flavors', 'kg', 2.80, 1.00, 2800.00),
(19, 1, 'Pure Madagascar Vanilla Extract', 'Spices & Flavors', 'L', 3.50, 2.00, 4200.00),
(20, 1, 'Organic Cinnamon Powder', 'Spices & Flavors', 'kg', 4.00, 2.00, 650.00),
(21, 1, 'Fresh Alphonso Mango Pulp (Tin 850g)', 'Fruits & Fillings', 'pcs', 24.00, 12.00, 220.00),
(22, 1, 'Spiced Potato Masala Mix', 'Savory Fillings', 'kg', 25.00, 15.00, 80.00),
(23, 1, 'Paneer Tikka Filling Mix', 'Savory Fillings', 'kg', 14.00, 8.00, 260.00),
(24, 1, 'Kashmiri Walnut Halves', 'Nuts & Seeds', 'kg', 15.00, 8.00, 920.00),
(25, 1, 'Biodegradable Cake Boxes (1kg)', 'Packaging Materials', 'pcs', 150.00, 50.00, 24.00),
(26, 1, 'Kraft Paper Pastry Sleeves', 'Packaging Materials', 'pcs', 300.00, 100.00, 4.50)
ON CONFLICT (id) DO NOTHING;

-- 10. Raw Material Lots (Clean - populated on supplier procurement)
-- 11. Stock Requisitions (Clean - populated on baker requisition requests)

-- 12. Recipes
INSERT INTO recipes (id, business_id, product_id, yield_quantity, yield_unit, prep_time_minutes, bake_time_minutes, instructions) VALUES
(1, 1, 1, 10, 'loaves', 120, 45, 'Autolyse flour and water 1 hr. Add starter and salt. Bulk ferment 4 hrs with stretch and folds. Shape, cold retard 18 hrs at 4°C. Bake in steam deck oven at 240°C for 25 mins, vent 20 mins at 210°C.'),
(2, 1, 5, 24, 'croissants', 180, 22, 'Mix dough, chill overnight. Perform 3 single book folds with chilled 84% butter block. Rest dough 1 hr between folds. Sheet to 3.5mm, cut triangles, roll gently. Proof 2.5 hrs at 26°C with 80% humidity. Egg wash and bake at 195°C for 20 mins.'),
(3, 1, 9, 2, 'cakes (1kg)', 60, 35, 'Whisk flour, cocoa powder, sugar, baking powder. Fold in milk, melted butter, and vanilla. Pour into 8-inch tins. Bake at 175°C for 35 mins. Cool completely. Slice into 3 tiers, soak with sugar syrup, fill and mask with warm dark chocolate ganache.'),
(4, 1, 14, 30, 'puffs', 90, 25, 'Prepare laminated puff pastry dough with ghee layers. Prepare spiced potato-pea filling with cumin, ginger, and garam masala. Cool filling. Cut dough squares, place 40g filling, fold diagonally, crimp edges. Bake at 210°C for 25 mins until golden and puffed.'),
(5, 1, 17, 10, 'packs', 60, 25, 'Layer refined flour dough with chilled ghee laminations. Rest 30 mins. Roll out thin, sprinkle salt and carom seeds. Fold into layers, slice into rectangular biscuit batons. Bake at 180°C for 25 mins until blistered and light.'),
(6, 1, 18, 12, 'packs', 45, 20, 'Cream pure cow ghee and powdered sugar until pale and fluffy. Gently sift in flour, semolina, and freshly ground cardamom powder. Form into small 20g balls. Press a sliver of pistachio in the center. Bake at 160°C for 20 mins without browning too much.'),
(7, 1, 20, 16, 'brownie squares', 40, 30, 'Melt 54% Callebaut dark chocolate with unsalted butter over a bain-marie. Whisk eggs and brown sugar until glossy. Fold chocolate mixture into eggs. Gently fold in flour, cocoa powder, and toasted Kashmiri walnuts. Bake in parchment-lined tray at 170°C for 28 mins.')
ON CONFLICT (id) DO NOTHING;

-- 13. Recipe Ingredients
INSERT INTO recipe_ingredients (id, recipe_id, raw_material_id, quantity_required, unit) VALUES
-- Sourdough (Recipe 1)
(1, 1, 1, 4.50, 'kg'),
(2, 1, 2, 0.50, 'kg'),
(3, 1, 8, 0.05, 'kg'),

-- Croissant (Recipe 2)
(4, 2, 1, 1.20, 'kg'),
(5, 2, 10, 0.60, 'kg'),
(6, 2, 15, 0.12, 'kg'),
(7, 2, 8, 0.03, 'kg'),
(8, 2, 12, 0.40, 'L'),

-- Chocolate Truffle Cake (Recipe 3)
(9, 3, 1, 0.45, 'kg'),
(10, 3, 4, 0.18, 'kg'),
(11, 3, 5, 0.40, 'kg'),
(12, 3, 10, 0.20, 'kg'),
(13, 3, 11, 0.50, 'L'),
(14, 3, 15, 0.35, 'kg'),

-- Masala Puff (Recipe 4)
(15, 4, 1, 1.00, 'kg'),
(16, 4, 9, 0.25, 'L'),
(17, 4, 22, 1.20, 'kg'),

-- Khari (Recipe 5)
(18, 5, 1, 1.50, 'kg'),
(19, 5, 9, 0.40, 'L'),

-- Nankhatai (Recipe 6)
(20, 6, 1, 0.80, 'kg'),
(21, 6, 9, 0.45, 'L'),
(22, 6, 15, 0.35, 'kg'),
(23, 6, 18, 0.02, 'kg'),

-- Walnut Brownie (Recipe 7)
(24, 7, 5, 0.50, 'kg'),
(25, 7, 10, 0.25, 'kg'),
(26, 7, 1, 0.25, 'kg'),
(27, 7, 17, 0.30, 'kg'),
(28, 7, 24, 0.20, 'kg')
ON CONFLICT (id) DO NOTHING;

-- 14-25. Operational Tables (Batches, Orders, Logs, Payments, QC, Feedback: Clean)

-- Synchronize all sequences with table max IDs
SELECT setval('businesses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM businesses));
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('qr_codes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM qr_codes));
SELECT setval('customer_addresses_id_seq', (SELECT COALESCE(MAX(id), 1) FROM customer_addresses));
SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories));
SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM products));
SELECT setval('product_variants_id_seq', (SELECT COALESCE(MAX(id), 1) FROM product_variants));
SELECT setval('suppliers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM suppliers));
SELECT setval('raw_materials_id_seq', (SELECT COALESCE(MAX(id), 1) FROM raw_materials));
SELECT setval('raw_material_lots_id_seq', (SELECT COALESCE(MAX(id), 1) FROM raw_material_lots));
SELECT setval('stock_requisitions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM stock_requisitions));
SELECT setval('recipes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM recipes));
SELECT setval('recipe_ingredients_id_seq', (SELECT COALESCE(MAX(id), 1) FROM recipe_ingredients));
SELECT setval('production_batches_id_seq', (SELECT COALESCE(MAX(id), 1) FROM production_batches));
SELECT setval('batch_workers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM batch_workers));
SELECT setval('batch_materials_consumed_id_seq', (SELECT COALESCE(MAX(id), 1) FROM batch_materials_consumed));
SELECT setval('production_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM production_logs));
SELECT setval('orders_id_seq', (SELECT COALESCE(MAX(id), 1) FROM orders));
SELECT setval('order_items_id_seq', (SELECT COALESCE(MAX(id), 1) FROM order_items));
SELECT setval('batch_orders_id_seq', (SELECT COALESCE(MAX(id), 1) FROM batch_orders));
SELECT setval('order_status_history_id_seq', (SELECT COALESCE(MAX(id), 1) FROM order_status_history));
SELECT setval('payments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM payments));
SELECT setval('wastage_logs_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wastage_logs));
SELECT setval('quality_checks_id_seq', (SELECT COALESCE(MAX(id), 1) FROM quality_checks));
SELECT setval('customer_feedback_id_seq', (SELECT COALESCE(MAX(id), 1) FROM customer_feedback));
