const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', '..', 'bakery.sqlite');
if (!fs.existsSync(dbPath) && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('SQLite database missing. Restore the existing database; demo initialization requires ALLOW_DEMO_SEED=true.');
}
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high performance & reliability
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Register custom SQL functions to mirror PostgreSQL
db.function('TO_CHAR', (dateVal, fmt) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  if (fmt === 'Dy') {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  }
  if (fmt && fmt.includes('HH12:MI')) {
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return d.toISOString();
});

db.function('GREATEST', (a, b) => {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return Math.max(numA, numB);
});

// Initialize schema and seed data if tables don't exist
const initializeSqliteDb = () => {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (tableCheck) {
    return;
  }

  console.log('[SQLite Engine] Initializing persistent disk database at:', dbPath);

  db.exec(`
    -- 1. Businesses
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#5A3825',
      secondary_color TEXT DEFAULT '#8B5A2B',
      accent_color TEXT DEFAULT '#D96C8A',
      currency TEXT DEFAULT 'INR',
      timezone TEXT DEFAULT 'Asia/Kolkata',
      contact_email TEXT,
      contact_phone TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      postal_code TEXT,
      state TEXT,
      country TEXT DEFAULT 'India',
      fssai_license TEXT,
      upi_vpa TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Users
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('customer', 'baker', 'staff', 'manager', 'owner')) NOT NULL,
      shift TEXT,
      crumb_points INTEGER DEFAULT 0,
      hourly_rate NUMERIC(10,2) DEFAULT 0.00,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. QR Codes
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      qr_type TEXT NOT NULL,
      unique_code TEXT UNIQUE NOT NULL,
      target_url TEXT NOT NULL,
      location_tag TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Customer Addresses
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      label TEXT,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      contact_phone TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Products
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      category_id INTEGER REFERENCES categories(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      base_price NUMERIC(10,2) NOT NULL,
      is_eggless INTEGER DEFAULT 0,
      shelf_life_days INTEGER DEFAULT 3,
      delivery_fee NUMERIC DEFAULT NULL,
      is_available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Product Variants
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      sku TEXT UNIQUE,
      selling_price NUMERIC(10,2) NOT NULL,
      is_default INTEGER DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      lead_time_days INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Raw Materials
    CREATE TABLE IF NOT EXISTS raw_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Key Flours & Powders',
      sku TEXT,
      unit TEXT NOT NULL,
      current_stock NUMERIC(10,2) DEFAULT 0,
      min_reorder_level NUMERIC(10,2) DEFAULT 10,
      minimum_stock NUMERIC(10,2) DEFAULT 10,
      reorder_quantity NUMERIC(10,2) DEFAULT 25,
      cost_per_unit NUMERIC(10,2) DEFAULT 0,
      primary_supplier_id INTEGER REFERENCES suppliers(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Raw Material Lots
    CREATE TABLE IF NOT EXISTS raw_material_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      lot_number TEXT NOT NULL,
      procured_quantity NUMERIC(10,2) NOT NULL,
      remaining_quantity NUMERIC(10,2) NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      purchase_date DATE DEFAULT CURRENT_DATE,
      expiry_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 11. Stock Requisitions
    CREATE TABLE IF NOT EXISTS stock_requisitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      raw_material_id INTEGER REFERENCES raw_materials(id),
      requested_by INTEGER REFERENCES users(id),
      baker_id INTEGER REFERENCES users(id),
      material_name TEXT,
      quantity NUMERIC(10,2) NOT NULL,
      unit TEXT NOT NULL,
      urgency TEXT DEFAULT 'Normal',
      status TEXT DEFAULT 'Pending',
      notes TEXT,
      request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 12. Recipes
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      recipe_name TEXT NOT NULL,
      batch_yield_units INTEGER DEFAULT 1,
      prep_time_mins INTEGER DEFAULT 15,
      bake_time_mins INTEGER DEFAULT 30,
      total_time_mins INTEGER DEFAULT 45,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Recipe Ingredients
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id),
      raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id),
      quantity NUMERIC(10,3) NOT NULL,
      unit TEXT NOT NULL
    );

    -- 14. Production Batches
    CREATE TABLE IF NOT EXISTS production_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      batch_no TEXT NOT NULL,
      batch_code TEXT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      baker_id INTEGER REFERENCES users(id),
      planned_quantity INTEGER NOT NULL,
      completed_quantity INTEGER DEFAULT 0,
      produced_quantity INTEGER DEFAULT 0,
      actual_usable_qty INTEGER DEFAULT 0,
      wastage_quantity INTEGER DEFAULT 0,
      packed_quantity INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Planned',
      priority TEXT DEFAULT 'Normal',
      shift TEXT DEFAULT 'Morning Shift',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. Batch Workers
    CREATE TABLE IF NOT EXISTS batch_workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES production_batches(id),
      worker_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT,
      hours_worked NUMERIC(6,2) DEFAULT 0.00
    );

    -- 16. Production Logs
    CREATE TABLE IF NOT EXISTS production_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES production_batches(id),
      baker_id INTEGER REFERENCES users(id),
      previous_status TEXT,
      new_status TEXT NOT NULL,
      completed_quantity INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. Orders
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      order_no TEXT NOT NULL,
      customer_id INTEGER REFERENCES users(id),
      order_type TEXT DEFAULT 'delivery',
      address_id INTEGER REFERENCES customer_addresses(id),
      delivery_time_slot TEXT DEFAULT 'Now (30-45 mins)',
      order_status TEXT DEFAULT 'Order Placed',
      payment_status TEXT DEFAULT 'Pending Verification',
      payment_method TEXT DEFAULT 'QR_UPI',
      subtotal NUMERIC(10,2) NOT NULL,
      delivery_fee NUMERIC(10,2) DEFAULT 0,
      tax_amount NUMERIC(10,2) DEFAULT 0,
      discount_amount NUMERIC(10,2) DEFAULT 0,
      total_amount NUMERIC(10,2) NOT NULL,
      special_instructions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Order Items
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_variant_id INTEGER REFERENCES product_variants(id),
      product_id INTEGER,
      product_name TEXT,
      variant_name TEXT,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL
    );

    -- 19. Batch Orders
    CREATE TABLE IF NOT EXISTS batch_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES production_batches(id),
      order_id INTEGER NOT NULL REFERENCES orders(id),
      order_reference TEXT,
      quantity INTEGER DEFAULT 1
    );

    -- 20. Order Status History
    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      status TEXT NOT NULL,
      notes TEXT,
      updated_by INTEGER REFERENCES users(id),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 21. Payments
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      order_id INTEGER NOT NULL REFERENCES orders(id),
      payment_mode TEXT NOT NULL,
      qr_reference_code TEXT,
      amount_paid NUMERIC(10,2) NOT NULL,
      status TEXT DEFAULT 'Initiated',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 22. Wastage Logs
    CREATE TABLE IF NOT EXISTS wastage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      batch_id INTEGER REFERENCES production_batches(id),
      baker_id INTEGER REFERENCES users(id),
      recorded_by INTEGER REFERENCES users(id),
      material_name TEXT,
      quantity NUMERIC(10,2) DEFAULT 0,
      quantity_wasted NUMERIC(10,2) DEFAULT 0,
      unit TEXT DEFAULT 'pcs',
      reason TEXT NOT NULL,
      notes TEXT,
      cost_loss NUMERIC(10,2) DEFAULT 0,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 23. Quality Checks
    CREATE TABLE IF NOT EXISTS quality_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      batch_id INTEGER NOT NULL REFERENCES production_batches(id),
      inspector_id INTEGER REFERENCES users(id),
      result TEXT NOT NULL,
      internal_temp NUMERIC(5,2),
      notes TEXT,
      quality_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 24. Customer Feedback
    CREATE TABLE IF NOT EXISTS customer_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL REFERENCES businesses(id),
      order_id INTEGER REFERENCES orders(id),
      customer_id INTEGER REFERENCES users(id),
      rating INTEGER NOT NULL,
      comments TEXT,
      overall_rating INTEGER DEFAULT 5,
      taste_rating INTEGER DEFAULT 5,
      freshness_rating INTEGER DEFAULT 5,
      delivery_rating INTEGER DEFAULT 5,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed Realistic Real-world Data
  const DEFAULT_HASH = '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G'; // Password@123

  // 1. Businesses
  db.prepare(`
    INSERT INTO businesses (id, name, slug, logo_url, primary_color, secondary_color, accent_color, contact_email, contact_phone, address_line1, city, postal_code, state, fssai_license, upi_vpa, is_active)
    VALUES (1, 'Crumb & Co.', 'crumbandco', '/assets/logos/crumbandco.svg', '#5A3825', '#8B5A2B', '#D96C8A', 'order@crumbandco.in', '+91 98765 43210', 'Sea Breeze, Carter Road', 'Mumbai', '400050', 'Maharashtra', '12245087001234', 'crumbandco@hdfcbank', 1),
           (2, 'The French Loaf Bakery', 'frenchloaf', '/assets/logos/frenchloaf.svg', '#1E3A8A', '#2563EB', '#F59E0B', 'contact@frenchloaf.com', '+91 98111 22334', '15 Brigade Road', 'Bengaluru', '560025', 'Karnataka', '11223344556677', 'frenchloaf@icici', 1)
  `).run();

  // 2. Users (RBAC)
  const userInsert = db.prepare(`
    INSERT INTO users (id, business_id, name, email, phone, password_hash, role, shift, crumb_points, hourly_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  userInsert.run(1, 1, 'Priya Sharma', 'priya.sharma@crumbco.com', '+91-98201-00001', DEFAULT_HASH, 'owner', 'Morning Shift', 0, 0.00);
  userInsert.run(2, 1, 'Elena Vance', 'elena.owner@crumbandco.in', '+91-98201-00002', DEFAULT_HASH, 'owner', 'Morning Shift', 0, 0.00);
  userInsert.run(3, 1, 'Marcus Brody', 'marcus.mgr@crumbandco.in', '+91-98201-00003', DEFAULT_HASH, 'manager', 'Morning Shift', 0, 220.00);
  userInsert.run(4, 1, 'Rajesh Kumar', 'baker@crumbco.com', '+91-98201-00004', DEFAULT_HASH, 'baker', 'Morning Shift', 0, 150.00);
  userInsert.run(5, 1, 'Chef Antonio Rossi', 'antonio.baker@crumbandco.in', '+91-98201-00005', DEFAULT_HASH, 'baker', 'Morning Shift', 0, 180.00);

  // 4. Categories
  const catInsert = db.prepare(`INSERT INTO categories (id, business_id, name, slug, description, display_order) VALUES (?, ?, ?, ?, ?, ?)`);
  catInsert.run(1, 1, 'Artisan Breads', 'breads', 'Naturally fermented sourdough loaves and rustic baguettes', 1);
  catInsert.run(2, 1, 'Viennoiserie & Pastries', 'pastries', 'Flaky French butter croissants and danishes', 2);
  catInsert.run(3, 1, 'Artisanal Cakes', 'cakes', 'Deck-oven baked celebration cakes and classic teacakes', 3);
  catInsert.run(4, 1, 'Savory Delights & Puffs', 'savory', 'Crisp spiced masala puffs, rolls, and quiches', 4);
  catInsert.run(5, 1, 'Cookies, Biscuits & Khari', 'cookies', 'Melt-in-mouth nankhatai, flaky khari, and cookies', 5);
  catInsert.run(6, 1, 'Brownies & Teacakes', 'brownies-teacakes', 'Dense Belgian dark chocolate brownies', 6);
  catInsert.run(7, 1, 'Cold Brews & Beverages', 'beverages', 'Artisan cold brewed coffees and masala chai', 7);

  // 5. Products (23 items)
  const prodInsert = db.prepare(`
    INSERT INTO products (id, business_id, category_id, name, slug, description, image_url, is_eggless, shelf_life_days, base_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  prodInsert.run(1, 1, 1, 'San Francisco Sourdough Loaf', 'san-francisco-sourdough', '36-hour slow fermented artisan sourdough with a blistered caramel crust and open crumb.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600', 1, 4, 180.00);
  prodInsert.run(2, 1, 1, 'Multigrain Seeded Sourdough', 'multigrain-seeded-sourdough', 'Whole wheat loaf crusted with toasted flaxseed, sunflower seeds, pumpkin seeds, and oats.', 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600', 1, 4, 210.00);
  prodInsert.run(3, 1, 1, 'French Rustic Baguette', 'french-rustic-baguette', 'Classic French slender loaf with golden crispy crust and light airy crumb.', 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600', 1, 2, 140.00);
  prodInsert.run(4, 1, 1, 'Olive & Rosemary Focaccia', 'olive-rosemary-focaccia', 'Extra virgin olive oil dough dimpled with Kalamata olives, fresh rosemary, and sea salt.', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600', 1, 3, 160.00);
  prodInsert.run(5, 1, 2, 'Butter Croissant', 'butter-croissant', 'Multi-layered flaky French pastry prepared with cultured 84% European butter, baked golden.', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600', 0, 2, 180.00);
  prodInsert.run(6, 1, 2, 'Pain au Chocolat', 'pain-au-chocolat', 'Crisp butter puff pastry encasing two batons of intense 55% Valrhona dark chocolate.', 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=600', 0, 2, 210.00);
  prodInsert.run(7, 1, 2, 'Almond Frangipane Croissant', 'almond-frangipane-croissant', 'Twice-baked croissant soaked in vanilla syrup, stuffed with rich almond frangipane cream.', 'https://images.unsplash.com/photo-1623334044303-241021148842?w=600', 0, 2, 240.00);
  prodInsert.run(8, 1, 2, 'Fresh Blueberry Danish', 'fresh-blueberry-danish', 'Square laminated pastry filled with vanilla bean pastry cream and tart wild blueberry compote.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600', 0, 2, 190.00);
  prodInsert.run(9, 1, 3, 'Belgian Chocolate Truffle Cake', 'chocolate-truffle-cake', 'Layers of intense dark chocolate sponge filled with silken 70% dark Belgian chocolate ganache.', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600', 1, 3, 850.00);
  prodInsert.run(10, 1, 3, 'Classic Red Velvet Cake', 'classic-red-velvet-cake', 'Moist crimson cocoa sponge layered with whipped Philadelphia cream cheese frosting.', 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600', 0, 3, 800.00);
  prodInsert.run(11, 1, 3, 'New York Baked Cheesecake', 'new-york-baked-cheesecake', 'Dense, velvety smooth baked cream cheese filling over a buttery graham cracker crust.', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600', 0, 4, 950.00);
  prodInsert.run(12, 1, 3, 'Traditional Parsi Mawa Cake', 'parsi-mawa-cake', 'Classic Bombay bakery dense sponge infused with fresh evaporated milk solids, cardamom, and nutmeg.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600', 0, 4, 120.00);
  prodInsert.run(13, 1, 3, 'Alphonso Mango Mousse Cake', 'alphonso-mango-mousse-cake', 'Light vanilla sponge layered with Ratnagiri Alphonso mango puree mousse and mirror glaze.', 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600', 1, 3, 900.00);
  prodInsert.run(14, 1, 4, 'Spiced Masala Potato Puff', 'masala-puff', 'Crisp puff pastry packed with aromatic cumin, green pea, and spiced potato filling.', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600', 1, 1, 45.00);
  prodInsert.run(15, 1, 4, 'Paneer Tikka Puff Roll', 'paneer-tikka-puff', 'Tandoori marinated cottage cheese cubes with peppers folded in golden flaky pastry.', 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600', 1, 1, 65.00);
  prodInsert.run(16, 1, 4, 'Mushroom & Thyme Quiche Tart', 'mushroom-thyme-quiche', 'Buttery shortcrust tart filled with sautéed button mushrooms, fresh thyme, and savory custard.', 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=600', 0, 2, 130.00);
  prodInsert.run(17, 1, 5, 'Hand-Rolled Butter Khari Pack', 'khari-biscuit-pack', 'Golden layered puff biscuits baked crisp and light. Bandra’s favorite companion for cutting chai.', 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=600', 1, 15, 120.00);
  prodInsert.run(18, 1, 5, 'Traditional Cardamom Nankhatai Pack', 'nankhatai-pack', 'Authentic spiced cardamom shortbread made with pure cow ghee that crumbles delicately.', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600', 1, 20, 150.00);
  prodInsert.run(19, 1, 5, 'Double Dark Chocolate Sea Salt Cookies', 'dark-chocolate-sea-salt-cookies', 'Fudgy Dutch cocoa cookies studded with Belgian dark chocolate chips and Maldon sea salt.', 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600', 1, 10, 180.00);
  prodInsert.run(20, 1, 6, 'Fudgy Belgian Walnut Brownie', 'fudgy-walnut-brownie', 'Rich, chewy dark chocolate brownie loaded with toasted Kashmiri walnuts and a crackly crust.', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600', 1, 5, 140.00);
  prodInsert.run(21, 1, 6, 'Salted Caramel Fudge Brownie', 'salted-caramel-brownie', 'Fudge brownie swirled with house-made sea salt caramel and dark chocolate callets.', 'https://images.unsplash.com/photo-1515037893149-de7f840978e2?w=600', 1, 5, 150.00);
  prodInsert.run(22, 1, 7, 'Artisan Cold Brew Vanilla Latte', 'cold-brew-vanilla-latte', '18-hour cold steeped Chikmagalur Arabica blend shaken with whole milk and Madagascar vanilla.', 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600', 1, 2, 160.00);
  prodInsert.run(23, 1, 7, 'Spiced Masala Cutting Chai Flask', 'masala-chai-flask', 'Authentic Mumbai cutting chai brewed with fresh ginger, crushed cardamom, and spices (500ml).', 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600', 1, 1, 110.00);

  // 6. Product Variants
  const varInsert = db.prepare(`INSERT INTO product_variants (id, product_id, name, sku, selling_price, is_default) VALUES (?, ?, ?, ?, ?, ?)`);
  varInsert.run(1, 1, 'Standard 500g Loaf', 'CRUMB-SD-500', 180.00, 1);
  varInsert.run(2, 1, 'Large 1kg Family Loaf', 'CRUMB-SD-1KG', 340.00, 0);
  varInsert.run(6, 5, 'Single Croissant', 'CRUMB-CR-SGL', 180.00, 1);
  varInsert.run(7, 5, 'Box of 4 Croissants', 'CRUMB-CR-BX4', 680.00, 0);
  varInsert.run(11, 9, '500g Bento Cake', 'CRUMB-TRF-500', 850.00, 1);
  varInsert.run(12, 9, '1kg Celebration Cake', 'CRUMB-TRF-1KG', 1600.00, 0);
  varInsert.run(13, 9, '2kg Party Cake', 'CRUMB-TRF-2KG', 3000.00, 0);
  varInsert.run(21, 14, 'Single Masala Puff', 'CRUMB-PUFF-SGL', 45.00, 1);

  // 7. Suppliers & Raw Materials
  db.prepare(`
    INSERT INTO suppliers (id, business_id, name, contact_name, phone, email, lead_time_days)
    VALUES (1, 1, 'Organic Grains India', 'Sunil Deshmukh', '+91 98200 11223', 'orders@organicgrains.in', 2),
           (2, 1, 'European Dairy Imports', 'Aline Moreau', '+91 98200 44556', 'sales@eurodairy.in', 3)
  `).run();

  const matInsert = db.prepare(`
    INSERT INTO raw_materials (id, business_id, name, category, sku, unit, current_stock, min_reorder_level, minimum_stock, cost_per_unit, primary_supplier_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  matInsert.run(1, 1, 'Organic Bread Flour (T65)', 'Key Flours & Powders', 'RAW-FLR-T65', 'kg', 145.50, 50.00, 50.00, 68.00, 1);
  matInsert.run(2, 1, 'Fine All Purpose Flour (Maida)', 'Key Flours & Powders', 'RAW-FLR-MAIDA', 'kg', 280.00, 100.00, 100.00, 42.00, 1);
  matInsert.run(3, 1, 'Whole Wheat Flour (Atta)', 'Key Flours & Powders', 'RAW-FLR-ATTA', 'kg', 160.00, 60.00, 60.00, 48.00, 1);
  matInsert.run(4, 1, 'Rich Cocoa Powder (Imported)', 'Chocolates & Cocoa', 'RAW-COCOA', 'kg', 6.50, 10.00, 10.00, 380.00, 2);
  matInsert.run(5, 1, 'Baking Powder (Double Acting)', 'Leavening & Additives', 'RAW-BP', 'kg', 2.80, 4.00, 4.00, 140.00, 1);
  matInsert.run(6, 1, 'French Cultured Butter (84%)', 'Dairy & Fats', 'RAW-BTR-84', 'kg', 38.00, 20.00, 20.00, 480.00, 2);
  matInsert.run(7, 1, 'Pure Cow Ghee', 'Dairy & Fats', 'RAW-GHEE', 'L', 75.00, 40.00, 40.00, 580.00, 1);
  matInsert.run(8, 1, 'Active Dry Yeast', 'Leavening & Additives', 'RAW-YEAST', 'kg', 5.20, 6.00, 6.00, 360.00, 1);
  matInsert.run(9, 1, 'Granulated White Sugar', 'Sweeteners', 'RAW-SUGAR', 'kg', 190.00, 80.00, 80.00, 44.00, 1);
  matInsert.run(10, 1, 'Valrhona 70% Dark Chocolate', 'Chocolates & Cocoa', 'RAW-CHOC-70', 'kg', 8.50, 15.00, 15.00, 1150.00, 2);
  matInsert.run(11, 1, 'Fresh Farm Eggs (Crate of 30)', 'Dairy & Fats', 'RAW-EGGS', 'pcs', 180.00, 90.00, 90.00, 7.50, 1);

  console.log('[SQLite Engine] Disk database initialized with clean catalog schema.');
};

// Safe migrations & seed verification ensuring demo accounts, recipes, and white-labeling exist
const ensureMigrationsAndSeeds = () => {
  const DEFAULT_HASH = '$2a$10$48/Sz/2XcsVQiywrSdj5w.I2/NUynMg6QGhmc3aMQi6YEUV7GZ04G'; // Password@123 & password123

  // 1. Safe Column Additions
  const safeAddColumn = (table, colDef) => {
    const column = colDef.split(/\s+/)[0];
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  };

  safeAddColumn('recipes', 'instructions TEXT');
  safeAddColumn('recipes', 'oven_temp_c INTEGER DEFAULT 200');
  safeAddColumn('recipes', 'yield_unit TEXT DEFAULT "pcs"');
  safeAddColumn('businesses', 'tagline TEXT DEFAULT "Freshly baked artisanal breads & treats"');
  safeAddColumn('businesses', 'announcement_bar TEXT');
  safeAddColumn('businesses', 'upi_qr_image TEXT');
  safeAddColumn('payments', 'screenshot_data TEXT');
  safeAddColumn('payments', 'screenshot_uploaded_at DATETIME');
  safeAddColumn('orders', 'delivery_date DATE');
  safeAddColumn('recipes', 'labour_cost_per_min NUMERIC(10,2) DEFAULT 2.50');
  safeAddColumn('recipes', 'power_cost_per_min NUMERIC(10,2) DEFAULT 1.20');
  safeAddColumn('recipes', 'packaging_cost_per_unit NUMERIC(10,2) DEFAULT 10.00');
  safeAddColumn('users', 'dismissed_at DATETIME DEFAULT NULL');
  safeAddColumn('users', 'dismissal_reason TEXT DEFAULT NULL');
  safeAddColumn('customer_feedback', 'user_id INTEGER');
  safeAddColumn('customer_feedback', 'comment TEXT');
  safeAddColumn('customer_feedback', 'batch_id INTEGER');
  safeAddColumn('customer_feedback', 'rating_overall INTEGER');
  safeAddColumn('customer_feedback', 'packaging_rating INTEGER DEFAULT 5');
  safeAddColumn('customer_feedback', 'is_complaint INTEGER DEFAULT 0');
  // Create the missing table before trying to add columns to it
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS batch_lot_consumption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quantity_consumed NUMERIC(10,3)
    );`);
  } catch (e) {
    console.error("Error creating batch_lot_consumption table:", e);
  }
  safeAddColumn('batch_lot_consumption', 'quantity_consumed NUMERIC(10,3)');

  // Timely auto-deletion of payment screenshots older than 30 days
  const cleanExpiredScreenshots = () => {
    try {
      const info = db.prepare(`
        UPDATE payments 
        SET screenshot_data = NULL
        WHERE (created_at < datetime('now', '-30 days') OR screenshot_uploaded_at < datetime('now', '-30 days'))
          AND screenshot_data IS NOT NULL
      `).run();
      if (info && info.changes > 0) {
        console.log(`[SQLite Engine] Cleaned ${info.changes} payment screenshots older than 30 days.`);
      }
    } catch (e) {
      console.warn('[SQLite] Screenshot auto-cleanup note:', e.message);
    }
  };
  cleanExpiredScreenshots();
  // Schedule recurring hourly cleanup
  if (process.env.NODE_ENV !== 'test') setInterval(cleanExpiredScreenshots, 60 * 60 * 1000).unref();

  try {
    db.exec(`DROP INDEX IF EXISTS idx_payments_business_utr`);
  } catch (e) {}

  // Other helper columns
  safeAddColumn('orders', 'guest_name TEXT');
  safeAddColumn('orders', 'guest_phone TEXT');
  safeAddColumn('orders', 'guest_email TEXT');
  safeAddColumn('orders', 'tracking_token TEXT');
  safeAddColumn('orders', 'rejection_reason TEXT');
  safeAddColumn('orders', 'rejected_by INTEGER');
  safeAddColumn('payments', 'rejection_reason TEXT');
  safeAddColumn('payments', 'verified_by INTEGER');
  safeAddColumn('payments', 'verified_at DATETIME');

  // Ensure these columns exist before backfilling
  safeAddColumn('order_items', 'product_id INTEGER');
  safeAddColumn('order_items', 'product_name TEXT');
  safeAddColumn('order_items', 'variant_name TEXT');

  // Backfill order_items product_name, variant_name, and product_id from existing products & variants
  try {
    db.exec(`
      UPDATE order_items 
      SET product_name = (
        SELECT p.name FROM product_variants pv 
        JOIN products p ON pv.product_id = p.id 
        WHERE pv.id = order_items.product_variant_id
      )
      WHERE product_name IS NULL AND product_variant_id IS NOT NULL;
    `);
    db.exec(`
      UPDATE order_items 
      SET variant_name = (
        SELECT pv.name FROM product_variants pv 
        WHERE pv.id = order_items.product_variant_id
      )
      WHERE variant_name IS NULL AND product_variant_id IS NOT NULL;
    `);
    db.exec(`
      UPDATE order_items 
      SET product_id = (
        SELECT pv.product_id FROM product_variants pv 
        WHERE pv.id = order_items.product_variant_id
      )
      WHERE product_id IS NULL AND product_variant_id IS NOT NULL;
    `);
  } catch (e) {
    console.warn('[SQLite] order_items backfill note:', e.message);
  }

  // Migration: Baker shift_name, shift_start, shift_end, clock-in status, and business out-of-shift login setting
  try {
    const userCols = db.prepare("PRAGMA table_info(users)").all();
    const hasShiftName = userCols.some((c) => c.name === 'shift_name');
    if (!hasShiftName) {
      db.exec(`
        ALTER TABLE users ADD COLUMN shift_name TEXT;
        ALTER TABLE users ADD COLUMN shift_start TEXT;
        ALTER TABLE users ADD COLUMN shift_end TEXT;
        ALTER TABLE users ADD COLUMN is_clocked_in INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN last_clock_in DATETIME;
      `);
    }

    const bizCols = db.prepare("PRAGMA table_info(businesses)").all();
    const hasBlockShift = bizCols.some((c) => c.name === 'block_out_of_shift_login');
    if (!hasBlockShift) {
      db.exec(`
        ALTER TABLE businesses ADD COLUMN block_out_of_shift_login INTEGER DEFAULT 0;
      `);
    }

    // Backfill seed baker shifts if shift_start is null
    db.exec(`
      UPDATE users 
      SET shift_name = 'Morning Shift', shift_start = '05:00', shift_end = '13:00', is_clocked_in = 1
      WHERE role = 'baker' AND (email LIKE '%rajesh%' OR email = 'baker@crumbco.com') AND (shift_start IS NULL OR shift_start = '');

      UPDATE users 
      SET shift_name = 'Evening Shift', shift_start = '13:00', shift_end = '21:00', is_clocked_in = 1
      WHERE role = 'baker' AND (email LIKE '%antonio%') AND (shift_start IS NULL OR shift_start = '');
    `);
  } catch (e) {
    console.warn('[SQLite] shift columns migration note:', e.message);
  }

  // Create Batch Lot Consumption table for Prompt M FEFO traceability
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS batch_lot_consumption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL DEFAULT 1,
        batch_id INTEGER,
        order_id INTEGER,
        raw_material_id INTEGER NOT NULL,
        lot_id INTEGER NOT NULL,
        consumed_quantity NUMERIC(10,3) NOT NULL,
        consumed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('[SQLite] batch_lot_consumption table note:', e.message);
  }

  safeAddColumn('raw_materials', "threshold_mode TEXT NOT NULL DEFAULT 'absolute'");
  safeAddColumn('raw_materials', 'reference_stock NUMERIC NOT NULL DEFAULT 0');
  safeAddColumn('raw_materials', 'threshold_percent NUMERIC NOT NULL DEFAULT 30');
  db.exec(`CREATE TABLE IF NOT EXISTS inventory_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id),
    reference_type TEXT NOT NULL, reference_id INTEGER NOT NULL,
    raw_material_id INTEGER NOT NULL REFERENCES raw_materials(id), quantity NUMERIC NOT NULL CHECK(quantity > 0),
    unit TEXT NOT NULL, unit_cost NUMERIC NOT NULL, status TEXT NOT NULL DEFAULT 'reserved',
    UNIQUE(business_id, reference_type, reference_id, raw_material_id)
  )`);
  for (const definition of ['gst_rate NUMERIC', 'tax_amount NUMERIC', 'unit_cost_at_order NUMERIC', 'cost_snapshot TEXT']) safeAddColumn('order_items', definition);
  safeAddColumn('wastage_logs', 'raw_material_id INTEGER REFERENCES raw_materials(id)');
  safeAddColumn('wastage_logs', 'idempotency_key TEXT');
  safeAddColumn('production_batches', 'unit_production_cost NUMERIC');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_wastage_idempotency ON wastage_logs(business_id, idempotency_key) WHERE idempotency_key IS NOT NULL');
  safeAddColumn('businesses', 'delivery_fee NUMERIC NOT NULL DEFAULT 50');
  safeAddColumn('businesses', 'free_delivery_threshold NUMERIC NOT NULL DEFAULT 500');
  safeAddColumn('businesses', 'delivery_gst_rate NUMERIC NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS finished_goods_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, business_id INTEGER NOT NULL REFERENCES businesses(id),
    order_id INTEGER NOT NULL REFERENCES orders(id), batch_id INTEGER NOT NULL REFERENCES production_batches(id),
    quantity NUMERIC NOT NULL CHECK(quantity > 0), movement_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, order_id, batch_id, movement_type)
  )`);
  safeAddColumn('recipes', 'other_cost NUMERIC NOT NULL DEFAULT 0');
  safeAddColumn('products', 'gst_rate NUMERIC NOT NULL DEFAULT 5');
  safeAddColumn('products', 'active_recipe_id INTEGER REFERENCES recipes(id)');
  safeAddColumn('products', 'delivery_fee NUMERIC DEFAULT NULL');
  db.exec('UPDATE products SET active_recipe_id = (SELECT MIN(r.id) FROM recipes r WHERE r.product_id = products.id AND r.business_id = products.business_id) WHERE active_recipe_id IS NULL');

  if (process.env.ALLOW_DEMO_SEED !== 'true') return;

  // Ensure multiple raw_material_lots for price trend calculation & FEFO
  try {
    db.exec(`
      UPDATE raw_materials SET primary_supplier_id = 1 WHERE primary_supplier_id IS NULL AND id IN (1, 2, 5, 6, 7);
      UPDATE raw_materials SET primary_supplier_id = 2 WHERE primary_supplier_id IS NULL AND id IN (3, 4, 8, 9, 10, 11, 12);
    `);
  } catch (e) {
    console.warn('[SQLite] primary_supplier_id backfill note:', e.message);
  }

  // 2. Ensure Standard Default Accounts
  const demoAccounts = [
    { name: 'Priya Sharma (Owner)', email: 'owner@crumbco.com', phone: '+91-98201-99991', role: 'owner', bId: 1 },
    { name: 'Rajesh Kumar (Baker)', email: 'baker@crumbco.com', phone: '+91-98201-00004', role: 'baker', bId: 1 },
    { name: 'Customer', email: 'customer@crumbco.com', phone: '+91-98201-99993', role: 'customer', bId: 1 },
    { name: 'Priya Sharma', email: 'priya.sharma@crumbco.com', phone: '+91-98201-00001', role: 'owner', bId: 1 },

  ];

  for (const acc of demoAccounts) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(acc.email);
    if (!existing) {
      db.prepare(`
        INSERT INTO users (business_id, name, email, phone, password_hash, role, shift, crumb_points, hourly_rate)
        VALUES (?, ?, ?, ?, ?, ?, 'Morning Shift', 1000, 200.00)
      `).run(acc.bId, acc.name, acc.email, acc.phone, DEFAULT_HASH, acc.role);
    }
  }

  // 3. Ensure Master Recipes Exist
  const recipeCount = db.prepare('SELECT COUNT(*) as count FROM recipes').get();
  if (!recipeCount || recipeCount.count === 0) {
    const rStmt = db.prepare(`
      INSERT INTO recipes (id, business_id, product_id, recipe_name, batch_yield_units, yield_unit, prep_time_mins, bake_time_mins, oven_temp_c, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    rStmt.run(
      1, 1, 5, 'European Butter Croissant Formula', 12, 'pcs', 180, 25, 200,
      '1. Prepare détrempe and chill 4 hours. 2. Lock in French cultured butter (84%) and perform 3 letter turns. 3. Proof at 26°C with 75% humidity for 2.5 hours until visibly jiggly. 4. Egg wash and bake at 200°C deck oven with steam for 22-25 mins until mahogany golden.'
    );
    rStmt.run(
      2, 1, 1, 'San Francisco Sourdough Master Formula', 2, 'loaves (500g)', 120, 45, 240,
      '1. Autolyse T65 organic flour with water for 60 mins. 2. Inoculate 20% active sourdough starter and fine salt. 3. Bulk ferment 4 hours with coil folds every 45 mins. 4. Cold retard 16 hours at 4°C. 5. Score with razor and bake in Dutch deck oven at 240°C with initial heavy steam.'
    );
    rStmt.run(
      3, 1, 9, 'Belgian Dark Chocolate Truffle Cake', 1, 'cake (1kg)', 60, 35, 170,
      '1. Whisk sponge batter incorporating Dutch cocoa and melted Valrhona dark chocolate. 2. Bake in lined 8-inch tins at 170°C for 35 mins. 3. Prepare 1:1 Belgian dark chocolate ganache with dairy cream. 4. Layer sponge with dark ganache, chill 2 hours, and pour mirror glaze.'
    );
    rStmt.run(
      4, 1, 3, 'French Rustic Baguette Tradition', 4, 'baguettes', 90, 22, 245,
      '1. Mix poolish fermented for 12 hours with T65 flour and water. 2. Gentle mix, short autolyse. 3. Ferment 2 hours with gentle turns. 4. Divide into 350g batons, rest 20 mins. 5. Shape slender baguettes, proof in couche linen for 45 mins. 6. Five diagonal slashes, bake at 245°C on stone with saturated steam.'
    );
    rStmt.run(
      5, 1, 14, 'Bombay Spiced Masala Potato Puff', 24, 'puffs', 75, 20, 210,
      '1. Prepare flaky puff pastry sheets using laminated butter technique. 2. Sauté cumin, turmeric, green chillies, boiled potatoes, and green peas with fresh coriander. 3. Cut 10x10cm puff squares, place spiced masala filling, fold triangularly and seal edges. 4. Brush with milk and bake at 210°C until crisp and puffed.'
    );
    rStmt.run(
      6, 1, 18, 'Pure Cow Ghee Cardamom Nankhatai', 2, 'packs (24 pcs)', 40, 18, 165,
      '1. Cream pure cow ghee and powdered sugar until light and fluffy. 2. Sift all-purpose flour, besan, and freshly ground cardamom powder. 3. Shape into round smooth discs, press pistachio slit on top. 4. Bake gently at 165°C for 18 mins without browning the top; cool completely before packing.'
    );

    // Recipe Ingredients
    const riStmt = db.prepare(`
      INSERT INTO recipe_ingredients (recipe_id, raw_material_id, quantity, unit)
      VALUES (?, ?, ?, ?)
    `);
    // Croissant
    riStmt.run(1, 2, 0.500, 'kg'); // Maida
    riStmt.run(1, 6, 0.280, 'kg'); // Butter 84%
    riStmt.run(1, 9, 0.040, 'kg'); // Sugar
    riStmt.run(1, 8, 0.012, 'kg'); // Yeast
    // Sourdough
    riStmt.run(2, 1, 0.800, 'kg'); // T65 flour
    riStmt.run(2, 3, 0.200, 'kg'); // Whole wheat
    riStmt.run(2, 8, 0.005, 'kg'); // Starter
    // Truffle cake
    riStmt.run(3, 2, 0.250, 'kg'); // Maida
    riStmt.run(3, 4, 0.120, 'kg'); // Cocoa
    riStmt.run(3, 10, 0.200, 'kg'); // Dark chocolate
    riStmt.run(3, 9, 0.180, 'kg'); // Sugar
    riStmt.run(3, 11, 4, 'pcs'); // Eggs
    // Masala puff
    riStmt.run(5, 2, 0.600, 'kg'); // Maida
    riStmt.run(5, 6, 0.300, 'kg'); // Butter
  }
};

// Execute initialization
initializeSqliteDb();
db.transaction(ensureMigrationsAndSeeds)();

// Query translation and execution helper
const query = (sql, params = []) => {
  let sqliteSql = sql;

  // Replace ILIKE with LIKE (case insensitive in SQLite)
  sqliteSql = sqliteSql.replace(/\bILIKE\b/gi, 'LIKE');
  // Remove PostgreSQL type casts like ::text, ::int
  sqliteSql = sqliteSql.replace(/::[a-zA-Z0-9_]+/g, '');

  // Handle postgres date/timestamp formatting differences
  // Persist UTC timestamps consistently across engines.

  // Handle boolean literals in query text
  sqliteSql = sqliteSql.replace(/\s*=\s*true\b/gi, ' = 1');
  sqliteSql = sqliteSql.replace(/\s*=\s*false\b/gi, ' = 0');
  sqliteSql = sqliteSql.replace(/\bIS\s+true\b/gi, 'IS 1');
  sqliteSql = sqliteSql.replace(/\bIS\s+false\b/gi, 'IS 0');
  sqliteSql = sqliteSql.replace(/,\s*true\b/gi, ', 1');
  sqliteSql = sqliteSql.replace(/,\s*false\b/gi, ', 0');
  sqliteSql = sqliteSql.replace(/\(\s*true\b/gi, '(1');
  sqliteSql = sqliteSql.replace(/\(\s*false\b/gi, '(0');

  // Accurately map numbered Postgres placeholders $1, $2 to ? and duplicate params when $N is repeated
  const cleanParams = [];
  sqliteSql = sqliteSql.replace(/\$(\d+)/g, (match, num) => {
    const idx = parseInt(num, 10) - 1;
    let val = params[idx];
    if (typeof val === 'boolean') val = val ? 1 : 0;
    cleanParams.push(val !== undefined ? val : null);
    return '?';
  });

  const isSelect = /^\s*SELECT/i.test(sqliteSql);
  const hasReturning = /RETURNING/i.test(sqliteSql);

  try {
    if (isSelect || hasReturning) {
      const stmt = db.prepare(sqliteSql);
      const rows = stmt.all(...cleanParams);
      return { rows, rowCount: rows.length };
    } else {
      const stmt = db.prepare(sqliteSql);
      const info = stmt.run(...cleanParams);
      return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  } catch (err) {
    console.error('[SQLite Query Error]', err.message);
    throw err;
  }
};

module.exports = {
  db,
  query,
  dbPath,
};
