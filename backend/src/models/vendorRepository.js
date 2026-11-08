const db = require('../config/db');

let memoryVendors = [
  {
    id: 1,
    business_id: 1,
    name: 'Sharma Flour Mills',
    rating: 4.8,
    contact_person: 'Rajesh Sharma',
    phone: '+91-98201-11223',
    email: 'orders@sharmaflour.in',
    primary_materials: ['All Purpose Flour (Maida)', 'Whole Wheat Flour (Atta)', 'Semolina'],
    contract_status: 'Active',
    last_delivery_date: '2026-10-02',
    price_per_kg: 42.0
  },
  {
    id: 2,
    business_id: 1,
    name: 'Amul Dairy Co-operative',
    rating: 4.9,
    contact_person: 'Vipul Patel',
    phone: '+91-98201-33445',
    email: 'mumbai.sales@amul.coop',
    primary_materials: ['Pure Cow Ghee', 'Unsalted Table Butter', 'Fresh Cream'],
    contract_status: 'Active',
    last_delivery_date: '2026-10-01',
    price_per_kg: 440.0
  },
  {
    id: 3,
    business_id: 1,
    name: 'Valrhona Gourmet Cocoa Imports',
    rating: 4.9,
    contact_person: 'Jean-Marc Dubois',
    phone: '+91-98201-55667',
    email: 'india@valrhona.com',
    primary_materials: ['Rich Cocoa Powder (Imported)', 'Dark Chocolate Chips (55%)'],
    contract_status: 'Active',
    last_delivery_date: '2026-09-28',
    price_per_kg: 380.0
  },
  {
    id: 4,
    business_id: 1,
    name: 'Deccan Spice & Essence Trading',
    rating: 4.7,
    contact_person: 'M. K. Rao',
    phone: '+91-98201-77889',
    email: 'supply@deccanspice.in',
    primary_materials: ['Fresh Cardamom (Elaichi)', 'Pure Vanilla Extract', 'Cinnamon Powder'],
    contract_status: 'Active',
    last_delivery_date: '2026-09-25',
    price_per_kg: 2800.0
  },
  {
    id: 5,
    business_id: 1,
    name: 'Royal Eco Packaging Solutions',
    rating: 4.6,
    contact_person: 'Sanjay Gupta',
    phone: '+91-98201-99001',
    email: 'orders@royalpackaging.in',
    primary_materials: ['Biodegradable Cake Boxes', 'Butter Paper', 'Pastry Sleeves'],
    contract_status: 'Active',
    last_delivery_date: '2026-10-03',
    price_per_kg: 18.0
  }
];

class VendorRepository {
  async getAllVendors(businessId = 1) {
    try {
      if (db.isConnected()) {
        const queryText = db.isPostgresConnected()
          ? `SELECT s.*, 
               COALESCE(json_agg(DISTINCT rm.name) FILTER (WHERE rm.name IS NOT NULL), '[]') as primary_materials
             FROM suppliers s
             LEFT JOIN raw_material_lots rml ON s.id = rml.supplier_id
             LEFT JOIN raw_materials rm ON rml.raw_material_id = rm.id
             WHERE s.business_id = $1
             GROUP BY s.id
             ORDER BY s.id ASC`
          : `SELECT s.*, '[]' as primary_materials
             FROM suppliers s
             WHERE s.business_id = $1
             ORDER BY s.id ASC`;
        const res = await db.query(queryText, [businessId]);
        if (res.rows.length > 0) {
          return res.rows.map(s => ({
            ...s,
            contract_status: null,
            price_per_kg: null,
            last_delivery_date: null
          }));
        }
      }
    } catch (err) {
      throw err;
    }
    return [];
  }

  async getVendorPriceHistory(materialName = '', businessId = 1) {
    try {
      if (db.isConnected()) {
        const queryText = `
          SELECT 
            s.id as supplier_id,
            s.name as supplier,
            COALESCE(s.lead_time_days, 2) as lead_time_days,
            rm.id as raw_material_id,
            rm.name as material,
            rm.unit,
            COALESCE(rm.cost_per_unit, 0) as material_cost,
            rml.id as lot_id,
            rml.lot_number,
            COALESCE(rml.unit_price, rm.cost_per_unit, 0) as lot_price,
            rml.purchase_date,
            rml.created_at
          FROM suppliers s
          JOIN raw_materials rm ON (rm.primary_supplier_id = s.id OR rm.id IN (SELECT raw_material_id FROM raw_material_lots WHERE supplier_id = s.id))
          LEFT JOIN raw_material_lots rml ON rml.supplier_id = s.id AND rml.raw_material_id = rm.id
          WHERE s.business_id = $1
          ORDER BY s.id ASC, rm.id ASC, rml.id DESC
        `;
        const res = await db.query(queryText, [businessId]);
        if (res.rows && res.rows.length > 0) {
          const map = new Map();
          for (const row of res.rows) {
            const key = `${row.supplier_id}_${row.raw_material_id}`;
            if (!map.has(key)) {
              map.set(key, {
                supplier: row.supplier,
                material: row.material,
                unit: row.unit || 'kg',
                lead_time_days: row.lead_time_days,
                material_cost: row.material_cost,
                lots: []
              });
            }
            if (row.lot_id) {
              map.get(key).lots.push(row);
            }
          }

          const history = [];
          for (const [key, item] of map.entries()) {
            const lots = item.lots;
            const currentPrice = lots.length > 0 ? Number(lots[0].lot_price) : Number(item.material_cost);
            const prevPrice = lots.length > 1 ? Number(lots[1].lot_price) : null;
            let trend = 'Stable';
            if (prevPrice !== null && prevPrice > 0) {
              const diff = currentPrice - prevPrice;
              const pct = Math.abs((diff / prevPrice) * 100).toFixed(1);
              if (diff > 0) trend = `Increasing (+${pct}%)`;
              else if (diff < 0) trend = `Decreasing (-${pct}%)`;
              else trend = 'Stable';
            } else if (lots.length === 0 && currentPrice === 0) {
              trend = '—';
            }

            history.push({
              supplier: item.supplier,
              material: item.material,
              cost: currentPrice > 0 ? `₹${currentPrice} / ${item.unit}` : '—',
              trend: trend,
              rating: '5.0 ★',
              leadTime: item.lead_time_days ? `${item.lead_time_days * 24} hrs` : '24 hrs',
              reliability: '99%'
            });
          }
          return history;
        }
      }
    } catch (err) {
      console.warn('[VendorRepository] getVendorPriceHistory error:', err.message);
    }
    return [];
  }

  async getComparativeVendors(businessId = 1) {
    const materials = await require('./inventoryRepository').getAllIngredients({ businessId });
    const lots = (await db.query('SELECT rml.*, s.name AS supplier_name, s.phone, s.email FROM raw_material_lots rml JOIN suppliers s ON rml.supplier_id = s.id AND s.business_id = rml.business_id WHERE rml.business_id = $1 ORDER BY rml.id DESC', [businessId])).rows;
    return materials.map(material => {
      const latest = new Map();
      for (const lot of lots.filter(row => row.raw_material_id === material.id)) if (!latest.has(lot.supplier_id)) latest.set(lot.supplier_id, lot);
      return { material_id: material.id, material_name: material.name, unit: material.unit, category: material.category, current_stock: material.current_stock, minimum_stock: material.minimum_stock, recommended_reorder_qty: material.suggested_replenishment, is_shortage: material.stock_status !== 'Optimal',
        quotes: [...latest.values()].map(lot => ({ supplier_id: lot.supplier_id, supplier_name: lot.supplier_name, phone: lot.phone, email: lot.email, price_per_unit: lot.unit_price, unit: material.unit, tag: 'Last recorded purchase; not a current quote', owner_approved: false, baker_approved: false })) };
    });
  }

  async createVendor({ name, contact_name, contact_person, phone, email, lead_time_days = 1, businessId = 1 }) {
    if (!name || !name.trim()) {
      const error = new Error('Supplier name is required');
      error.statusCode = 400;
      throw error;
    }
    const cleanName = name.trim();
    const contact = (contact_name || contact_person || '').trim() || null;
    const cleanPhone = (phone ? String(phone).trim() : null) || null;
    const cleanEmail = (email ? String(email).trim() : null) || null;
    const leadTime = parseInt(lead_time_days, 10) || 1;

    if (db.isConnected()) {
      if (db.isPostgresConnected()) {
        const queryText = `
          INSERT INTO suppliers (business_id, name, contact_person, phone, email, rating)
          VALUES ($1, $2, $3, $4, $5, 5.0)
          RETURNING *
        `;
        const res = await db.query(queryText, [businessId, cleanName, contact, cleanPhone, cleanEmail]);
        return res.rows[0];
      } else {
        const queryText = `
          INSERT INTO suppliers (business_id, name, contact_name, phone, email, lead_time_days)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        const res = await db.query(queryText, [businessId, cleanName, contact, cleanPhone, cleanEmail, leadTime]);
        return res.rows[0];
      }
    }
    throw new Error('Database is not connected');
  }

  async placeVendorOrder() {
    const error = new Error('Supplier order dispatch is not configured. Record goods actually received using Restock.');
    error.statusCode = 501; error.code = 'PROCUREMENT_NOT_CONFIGURED'; throw error;
  }
}
module.exports = new VendorRepository();
