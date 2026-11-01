"""
Tenant Isolation Verification Script
Tests multi-tenant scoping, query isolation, and scoped uniqueness between Business A and Business B.
"""
import sqlite3

def run_tests():
    conn = sqlite3.connect(":memory:")
    c = conn.cursor()

    # 1. Create tables
    c.executescript("""
    CREATE TABLE businesses (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        currency TEXT DEFAULT 'INR',
        timezone TEXT DEFAULT 'Asia/Kolkata',
        contact_email TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        address_line1 TEXT NOT NULL,
        city TEXT NOT NULL,
        postal_code TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
    );

    CREATE TABLE qr_codes (
        id INTEGER PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        qr_type TEXT NOT NULL,
        unique_code TEXT UNIQUE NOT NULL,
        target_url TEXT NOT NULL,
        location_tag TEXT,
        is_active INTEGER DEFAULT 1
    );

    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('customer', 'staff', 'baker', 'manager', 'owner'))
    );

    CREATE TABLE categories (
        id INTEGER PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        UNIQUE (business_id, slug)
    );

    CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        category_id INTEGER REFERENCES categories(id),
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        is_available INTEGER DEFAULT 1,
        UNIQUE (business_id, slug)
    );

    CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        order_no TEXT NOT NULL,
        customer_id INTEGER REFERENCES users(id),
        order_status TEXT NOT NULL,
        total_amount REAL NOT NULL,
        UNIQUE (business_id, order_no)
    );
    """)

    # 2. Insert Test Tenants
    c.execute("INSERT INTO businesses VALUES (1, 'Crumb & Co.', 'crumbandco', 'INR', 'Asia/Kolkata', 'order@crumb.in', '+91-98201-00001', 'Bandra', 'Mumbai', '400050', 1)")
    c.execute("INSERT INTO businesses VALUES (2, 'The French Loaf', 'frenchloaf', 'INR', 'Asia/Kolkata', 'info@fl.com', '+91-98111-22334', 'Brigade Rd', 'Bengaluru', '560025', 1)")

    # 3. Insert Users
    c.execute("INSERT INTO users VALUES (1, 1, 'Elena Vance', 'elena@crumb.in', '+91-98201-00001', 'owner')")
    c.execute("INSERT INTO users VALUES (2, 1, 'Antonio Rossi', 'antonio@crumb.in', '+91-98201-00002', 'baker')")
    c.execute("INSERT INTO users VALUES (3, 1, 'Ananya Nair', 'ananya@gmail.com', '+91-98201-54321', 'customer')")

    c.execute("INSERT INTO users VALUES (10, 2, 'Pierre Dubois', 'pierre@fl.com', '+91-98301-00010', 'owner')")
    c.execute("INSERT INTO users VALUES (11, 2, 'Lucas Bernard', 'lucas@fl.com', '+91-98301-00012', 'staff')")
    c.execute("INSERT INTO users VALUES (12, 2, 'Vikram Mehta', 'vikram@gmail.com', '+91-98301-54322', 'customer')")

    # 4. Insert QR Codes
    c.execute("INSERT INTO qr_codes VALUES (1, 1, 'table_order', 'QR-CRUMB-01', '/b/crumbandco?table=1', 'Table 1', 1)")
    c.execute("INSERT INTO qr_codes VALUES (2, 2, 'table_order', 'QR-FL-01', '/b/frenchloaf?table=1', 'Garden Table 1', 1)")

    # 5. Insert Products (Same slug 'sourdough' in BOTH businesses to test scoped uniqueness!)
    c.execute("INSERT INTO categories VALUES (1, 1, 'Artisan Breads', 'breads')")
    c.execute("INSERT INTO categories VALUES (2, 2, 'French Breads', 'breads')")

    c.execute("INSERT INTO products VALUES (1, 1, 1, 'San Francisco Sourdough', 'sourdough', 1)")
    c.execute("INSERT INTO products VALUES (2, 2, 2, 'Parisian Sourdough', 'sourdough', 1)")

    # 6. Insert Orders
    c.execute("INSERT INTO orders VALUES (1, 1, 'ORD-001', 3, 'In Production', 360.00)")
    c.execute("INSERT INTO orders VALUES (2, 2, 'ORD-001', 12, 'Delivered', 540.00)")

    conn.commit()

    # TEST A: Tenant Isolation on Products
    c.execute("SELECT name FROM products WHERE business_id = 1")
    crumb_prods = [r[0] for r in c.fetchall()]
    assert crumb_prods == ['San Francisco Sourdough'], f"Failed: {crumb_prods}"

    c.execute("SELECT name FROM products WHERE business_id = 2")
    fl_prods = [r[0] for r in c.fetchall()]
    assert fl_prods == ['Parisian Sourdough'], f"Failed: {fl_prods}"

    # TEST B: Tenant Isolation on Orders
    c.execute("SELECT order_no, total_amount FROM orders WHERE business_id = 1")
    crumb_orders = c.fetchall()
    assert len(crumb_orders) == 1 and crumb_orders[0] == ('ORD-001', 360.00)

    c.execute("SELECT order_no, total_amount FROM orders WHERE business_id = 2")
    fl_orders = c.fetchall()
    assert len(fl_orders) == 1 and fl_orders[0] == ('ORD-001', 540.00)

    # TEST C: Scoped Uniqueness (Same slug across different businesses is ALLOWED)
    assert len(crumb_prods) == 1 and len(fl_prods) == 1

    # TEST D: Duplicate slug WITHIN same business must FAIL
    duplicate_failed = False
    try:
        c.execute("INSERT INTO products VALUES (3, 1, 1, 'Duplicate Loaf', 'sourdough', 1)")
    except sqlite3.IntegrityError:
        duplicate_failed = True
    assert duplicate_failed, "Failed: Scoped unique constraint did not reject duplicate slug within same business!"

    # TEST E: QR Code Scoping
    c.execute("SELECT unique_code, location_tag FROM qr_codes WHERE business_id = 1")
    crumb_qr = c.fetchall()
    assert len(crumb_qr) == 1 and crumb_qr[0][0] == 'QR-CRUMB-01'

    c.execute("SELECT unique_code, location_tag FROM qr_codes WHERE business_id = 2")
    fl_qr = c.fetchall()
    assert len(fl_qr) == 1 and fl_qr[0][0] == 'QR-FL-01'

    print("ALL TENANT ISOLATION TESTS PASSED SUCCESSFULLY!")
    conn.close()

if __name__ == '__main__':
    run_tests()
