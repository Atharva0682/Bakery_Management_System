const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'bakery.sqlite');
const db = new Database(dbPath);

console.log('=============================================================');
console.log('[Clean DB] Removing Dummy/Seed Dataset (Preserving User Data)');
console.log('=============================================================\n');

db.pragma('foreign_keys = OFF');

// 1. Identify Dummy / Seed Order Numbers
const dummyOrderNos = [
  'ORD-CRUMB-1001', 'ORD-CRUMB-1002', 'ORD-CRUMB-1003', 'ORD-CRUMB-1004',
  'ORD-CRUMB-1005', 'ORD-CRUMB-1006', 'ORD-CRUMB-1007', 'ORD-CRUMB-1008',
  'ORD-CRUMB-1009', 'ORD-CRUMB-1010', 'ORD-CRUMB-1011', 'ORD-CRUMB-1012',
  'ORD-CRUMB-1013', 'ORD-CRUMB-1014', 'ORD-CRUMB-1015', 'ORD-CRUMB-1016',
  'ORD-CRUMB-1017', 'ORD-CRUMB-1018', 'ORD-CRUMB-1019', 'ORD-CRUMB-1020',
  'ORD-CRUMB-1021', 'ORD-CRUMB-1022', 'ORD-CRUMB-1023', 'ORD-CRUMB-1024',
  'ORD-FL-2001'
];

// 2. Identify Dummy / Seed Batches
const dummyBatchNos = [
  'BC-241', 'MP-112', 'TT-082', 'GK-009', 'NS-055', 'WB-031', 'SD-104', 'PC-042'
];

// 3. Identify Dummy / Seed Lots
const dummyLotNos = [
  'LOT-SFM-2026-8812', 'LOT-SFM-2026-8820', 'LOT-VAL-2026-4401', 'LOT-CAL-2026-1092',
  'LOT-AMUL-2026-902', 'LOT-AMUL-2026-908', 'LOT-AMUL-2026-915', 'LOT-GDJ-2026-771',
  'LOT-SWC-2026-301', 'LOT-DEC-2026-112', 'LOT-KASH-2026-88', 'LOT-FLR-2026-092',
  'LOT-FLR-2026-045', 'LOT-BTR-2026-012', 'LOT-COCOA-2026-001', 'LOT-COCOA-2026-PREV',
  'LOT-BTR-2025-081'
];

// 4. Identify Dummy / Seed Feedback comments
const dummyFeedbackSnippets = [
  'flakiest Butter Croissants in Bandra',
  'Sunday morning brunch unforgettable',
  'Belgian Chocolate Truffle Cake was rich',
  'Brownies were perfectly fudgy',
  'sourdough loaf keeps fresh for days',
  'pain au chocolat',
  'Authentic Parisian crust'
];

// 5. Delete only Dummy Orders and their items/payments/history
try {
  const dummyOrderIds = db.prepare(`
    SELECT id FROM orders 
    WHERE order_no IN (${dummyOrderNos.map(() => '?').join(',')})
       OR order_no LIKE 'ORD-CRUMB-10%'
  `).all(...dummyOrderNos).map(r => r.id);

  if (dummyOrderIds.length > 0) {
    const placeholders = dummyOrderIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM order_items WHERE order_id IN (${placeholders})`).run(...dummyOrderIds);
    db.prepare(`DELETE FROM payments WHERE order_id IN (${placeholders}) OR qr_reference_code LIKE 'UPI-UTR-CRUMB-%'`).run(...dummyOrderIds);
    db.prepare(`DELETE FROM order_status_history WHERE order_id IN (${placeholders})`).run(...dummyOrderIds);
    db.prepare(`DELETE FROM batch_orders WHERE order_id IN (${placeholders})`).run(...dummyOrderIds);
    db.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).run(...dummyOrderIds);
    console.log(` - Removed ${dummyOrderIds.length} dummy seed orders (user-added orders kept intact).`);
  } else {
    console.log(' - No dummy seed orders found (any user orders preserved).');
  }
} catch (e) {
  console.warn(' - Note on orders cleanup:', e.message);
}

// 6. Delete only Dummy Production Batches & logs
try {
  const dummyBatchIds = db.prepare(`
    SELECT id FROM production_batches 
    WHERE batch_no IN (${dummyBatchNos.map(() => '?').join(',')})
  `).all(...dummyBatchNos).map(r => r.id);

  if (dummyBatchIds.length > 0) {
    const placeholders = dummyBatchIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM batch_workers WHERE batch_id IN (${placeholders})`).run(...dummyBatchIds);
    try { db.prepare(`DELETE FROM batch_materials_consumed WHERE batch_id IN (${placeholders})`).run(...dummyBatchIds); } catch(e) {}
    try { db.prepare(`DELETE FROM batch_lot_consumption WHERE batch_id IN (${placeholders})`).run(...dummyBatchIds); } catch(e) {}
    try { db.prepare(`DELETE FROM production_logs WHERE batch_id IN (${placeholders})`).run(...dummyBatchIds); } catch(e) {}
    try { db.prepare(`DELETE FROM quality_checks WHERE batch_id IN (${placeholders})`).run(...dummyBatchIds); } catch(e) {}
    try { db.prepare(`DELETE FROM wastage_logs WHERE batch_id IN (${placeholders})`).run(...dummyBatchIds); } catch(e) {}
    db.prepare(`DELETE FROM production_batches WHERE id IN (${placeholders})`).run(...dummyBatchIds);
    console.log(` - Removed ${dummyBatchIds.length} dummy production batches (user-added batches kept intact).`);
  } else {
    console.log(' - No dummy production batches found (any user batches preserved).');
  }
} catch (e) {
  console.warn(' - Note on batches cleanup:', e.message);
}

// 7. Delete only Dummy Raw Material Lots
try {
  const lotRes = db.prepare(`
    DELETE FROM raw_material_lots 
    WHERE lot_number IN (${dummyLotNos.map(() => '?').join(',')})
  `).run(...dummyLotNos);
  console.log(` - Removed ${lotRes.changes} dummy lots (user-added lots kept intact).`);
} catch (e) {
  console.warn(' - Note on lots cleanup:', e.message);
}

// 8. Delete only Dummy Stock Requisitions
try {
  const reqRes = db.prepare(`
    DELETE FROM stock_requisitions 
    WHERE notes LIKE '%croissant laminations%' 
       OR notes LIKE '%Cocoa Powder shortage%' 
       OR notes LIKE '%Dark chocolate callets%'
       OR notes LIKE '%Cake boxes for weekend%'
  `).run();
  console.log(` - Removed ${reqRes.changes} dummy stock requisitions (user requisitions kept intact).`);
} catch (e) {
  console.warn(' - Note on requisitions cleanup:', e.message);
}

// 9. Delete only Dummy Feedback
try {
  for (const snippet of dummyFeedbackSnippets) {
    db.prepare(`DELETE FROM customer_feedback WHERE comments LIKE ? OR comment LIKE ?`).run(`%${snippet}%`, `%${snippet}%`);
  }
  console.log(' - Removed dummy customer feedback reviews (user feedback kept intact).');
} catch (e) {}

// 10. Delete Dummy Customer Addresses (from seed)
try {
  const dummyAddressLines = [
    'Sea Breeze Apartments, Carter Road',
    'Bungalow 14, Pali Hill Road',
    '12 Perry Cross Road',
    '702 Hill Crest, Hill Road',
    'Villa 88, Mount Mary Steps',
    '401 Palm Grove, Turner Road',
    '204 Silver Sands, Union Park',
    '15 Almeida Park, 5th Road',
    '101 Bay View, Chimbai Road',
    '502 Green Acres, 14th Road',
    '88 MG Road, Ashok Nagar'
  ];
  let deletedAddr = 0;
  for (const addr of dummyAddressLines) {
    const res = db.prepare('DELETE FROM customer_addresses WHERE address_line1 LIKE ?').run(`%${addr}%`);
    deletedAddr += res.changes;
  }
  console.log(` - Removed ${deletedAddr} dummy seed addresses (user-added addresses kept intact).`);
} catch (e) {}

// 11. Remove only fake seed/test users, preserving all real user-created accounts
const deleteUsersRes = db.prepare(`
  DELETE FROM users 
  WHERE email LIKE 'baker.test%' 
     OR email LIKE 'shift.policy.test%' 
     OR email LIKE 'rohan.test%' 
     OR email = 'realcustomer@example.com'
     OR email = 'ananya.customer@gmail.com'
     OR email = 'rohan.merchant@gmail.com'
     OR email = 'aisha.patel@outlook.com'
     OR email = 'vikram.singh@yahoo.com'
     OR email = 'neha.kapoor@gmail.com'
     OR email = 'sid.deshmukh@gmail.com'
     OR email = 'farah.k@rediffmail.com'
     OR email = 'kabir.mehta@gmail.com'
     OR email = 'zoya.akhtar@gmail.com'
     OR email = 'aditya.roy@gmail.com'
     OR email = 'pooja.bhatt@gmail.com'
     OR email = 'sameer.joshi@gmail.com'
`).run();
console.log(` - Cleaned ${deleteUsersRes.changes} fake seed/test customer accounts (user accounts kept intact).`);

db.pragma('foreign_keys = ON');

// Compact database
db.pragma('wal_checkpoint(TRUNCATE)');
db.exec('VACUUM');

console.log('\n=============================================================');
console.log('[Clean DB] Operation Complete. Current Table Counts:');
console.log('=============================================================');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
for (const t of tables) {
  const c = db.prepare('SELECT count(*) as count FROM ' + t.name).get();
  console.log(`   ${t.name.padEnd(25)}: ${c.count} rows`);
}

console.log('\n[Clean DB] Active Users (Default & User-Created):');
const users = db.prepare('SELECT id, name, email, role FROM users').all();
console.log(users);
db.close();