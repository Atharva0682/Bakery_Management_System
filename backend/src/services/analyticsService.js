const db = require('../config/db');
const { money } = require('../utils/costing');
const { getDateRangeBounds, getKolkataDateString, isRevenueOrder } = require('../utils/revenueRules');
const dateOf = value => getKolkataDateString(new Date(/Z$|[+]\d\d:/.test(String(value)) ? value : String(value).replace(' ', 'T') + 'Z'));
async function getAnalytics(businessId, range = 'this_week', startDate, endDate) {
  const bounds = getDateRangeBounds(range, startDate, endDate);
  const days = new Set(bounds.days.map(row => row.dateStr));
  const orders = (await db.query('SELECT * FROM orders WHERE business_id = $1', [businessId])).rows;
  const items = (await db.query('SELECT oi.* FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.business_id = $1', [businessId])).rows;
  const waste = (await db.query('SELECT * FROM wastage_logs WHERE business_id = $1', [businessId])).rows.filter(row => days.has(dateOf(row.recorded_at || row.created_at)));
  const selected = orders.filter(row => days.has(dateOf(row.created_at)));
  const paid = selected.filter(isRevenueOrder);
  const paidIds = new Set(paid.map(row => row.id));
  const sold = items.filter(row => paidIds.has(row.order_id));
  const sum = (rows, key) => money(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
  const subtotal = sum(paid, 'subtotal'), delivery = sum(paid, 'delivery_fee'), tax = sum(paid, 'tax_amount'), discount = sum(paid, 'discount_amount');
  const revenue = money(subtotal + delivery - discount);
  const costs = { material: 0, labour: 0, power: 0, packaging: 0, other: 0 };
  const ordersMissingItems = paid.filter(order => !sold.some(item => item.order_id === order.id)).length;
  let missing = ordersMissingItems; let units = 0;
  const products = new Map();
  for (const item of sold) {
    units += Number(item.quantity);
    let snapshot = null;
    try { snapshot = item.cost_snapshot ? JSON.parse(item.cost_snapshot) : null; } catch { snapshot = null; }
    if (!snapshot || Object.keys(costs).some(key => !Number.isFinite(Number(snapshot[key])))) { snapshot = null; missing++; }
    if (snapshot) for (const key of Object.keys(costs)) costs[key] += Number(snapshot[key]) * Number(item.quantity);
    const product = products.get(item.product_id || item.product_name) || { name: item.product_name || 'Historical product', units_sold: 0, revenue: 0, cost: 0, missing: false };
    product.units_sold += Number(item.quantity); product.revenue += Number(item.subtotal);
    if (snapshot) product.cost += Number(item.unit_cost_at_order) * Number(item.quantity); else product.missing = true;
    products.set(item.product_id || item.product_name, product);
  }
  for (const key of Object.keys(costs)) costs[key] = money(costs[key]);
  const totalCost = money(Object.values(costs).reduce((a, b) => a + b, 0));
  const wasteCost = sum(waste, 'cost_loss');
  const profit = missing ? null : money(revenue - totalCost - wasteCost);
  const summary = { revenue, product_sales: subtotal, customer_receipts: sum(paid, 'total_amount'), gst: tax, delivery_charges: delivery, discounts: discount,
    material_cost: costs.material, labor_cost: costs.labour, power_cost: costs.power, packaging_cost: costs.packaging, other_cost: costs.other,
    production_cost: missing ? null : totalCost, wastage_loss: wasteCost, gross_profit: missing ? null : money(revenue - totalCost), net_profit: profit,
    gross_margin_percent: !missing && revenue ? money((revenue - totalCost) / revenue * 100) : null,
    net_margin_percent: profit !== null && revenue ? money(profit / revenue * 100) : null,
    is_profit: profit === null ? null : profit >= 0, orders_count: paid.length, total_orders: selected.length, units_sold: units,
    average_order_value: paid.length ? money(sum(paid, 'total_amount') / paid.length) : 0,
    historical_orders_missing_items: ordersMissingItems, historical_items_missing_cost: missing - ordersMissingItems, costs_complete: missing === 0 };
  let daily = bounds.days.map(day => {
    const dayPaid = paid.filter(row => dateOf(row.created_at) === day.dateStr);
    return { date: day.dateStr, day: day.dayName, revenue: money(sum(dayPaid, 'subtotal') + sum(dayPaid, 'delivery_fee') - sum(dayPaid, 'discount_amount')), orders: dayPaid.length, wastage: sum(waste.filter(row => dateOf(row.recorded_at || row.created_at) === day.dateStr), 'cost_loss') };
  });
  if (daily.length > 35) {
    const buckets = new Map();
    for (const row of daily) {
      const key = row.date.slice(0, 7);
      const bucket = buckets.get(key) || { date: key, day: key, revenue: 0, orders: 0, wastage: 0, net_profit: null };
      bucket.revenue = money(bucket.revenue + row.revenue); bucket.orders += row.orders; bucket.wastage = money(bucket.wastage + row.wastage);
      buckets.set(key, bucket);
    }
    daily = [...buckets.values()];
  }
  const inventory = await require('../models/inventoryRepository').getAllIngredients({ businessId });
  const productionOverview = [];
  for (const order of orders.filter(row => !['Completed', 'Delivered', 'Rejected', 'Cancelled'].includes(row.order_status))) {
    try {
      const ingredients = await require('./productionInventoryService').availability('order', order.id, businessId);
      const lines = items.filter(row => row.order_id === order.id);
      const estimatedCost = lines.every(row => row.unit_cost_at_order !== null) ? money(lines.reduce((sum, row) => sum + Number(row.unit_cost_at_order) * Number(row.quantity), 0)) : null;
      productionOverview.push({ order_id: order.id, order_no: order.order_no, ready: ingredients.every(row => row.shortage <= 1e-9), ingredients, estimated_production_cost: estimatedCost, expected_profit: estimatedCost === null ? null : money(Number(order.subtotal) - Number(order.discount_amount) - estimatedCost) });
    } catch (error) { productionOverview.push({ order_id: order.id, order_no: order.order_no, ready: false, error: error.message, ingredients: [] }); }
  }
  const consumption = (await db.query("SELECT * FROM stock_movements WHERE business_id = $1 AND reference_type IN ('order', 'batch')", [businessId])).rows.filter(row => days.has(dateOf(row.created_at)));
  const lowStock = inventory.filter(row => row.stock_status !== 'Optimal');
  const inventoryAlerts = lowStock.map(i => ({
    type: i.stock_status === 'Critical' ? 'danger' : 'warning',
    text: `${i.name}: ${i.current_stock} ${i.unit} left (${i.stock_status} level, reorder at ${i.reorder_point || i.min_reorder_level} ${i.unit})`
  }));
  const alerts = [
    ...(missing ? [{ type: 'warning', text: `${missing - ordersMissingItems} historical line items have no cost snapshot and ${ordersMissingItems} paid orders have no item records. Profit is unavailable; historical costs have not been invented or recalculated.` }] : []),
    ...inventoryAlerts
  ];
  const topProducts = [...products.values()].sort((a, b) => b.units_sold - a.units_sold).map(p => ({ ...p, revenue: money(p.revenue), cost: p.missing ? null : money(p.cost), profit: p.missing ? null : money(p.revenue - p.cost), margin: p.missing || !p.revenue ? 'Unavailable' : `${money((p.revenue - p.cost) / p.revenue * 100)}%` }));
  const breakdown = {};
  for (const [key, predicate] of Object.entries({ paid: isRevenueOrder, pending: row => row.payment_status === 'Pending Verification', rejected: row => row.order_status === 'Rejected' || row.payment_status === 'Rejected', cancelled: row => row.order_status === 'Cancelled' })) {
    const rows = selected.filter(predicate); breakdown[key] = { count: rows.length, amount: sum(rows, 'total_amount') };
  }
  const todayPaid = paid.filter(row => dateOf(row.created_at) === getKolkataDateString());
  const today = { revenue: money(sum(todayPaid, 'subtotal') + sum(todayPaid, 'delivery_fee') - sum(todayPaid, 'discount_amount')), orders: todayPaid.length, wastage: sum(waste.filter(row => dateOf(row.recorded_at || row.created_at) === getKolkataDateString()), 'cost_loss') };
  return { range, period_label: `${bounds.days[0]?.dateStr} to ${bounds.days.at(-1)?.dateStr}`, summary,
    today: { revenue: today.revenue, orders_count: today.orders, net_profit: null, wastage_loss: today.wastage },
    daily_trend: daily, sales_trend: daily, top_products: topProducts, top_selling_products: topProducts,
    order_status_breakdown: breakdown, alerts, peak_hours: [],
    production_overview: productionOverview, inventory_consumption: consumption, low_stock_ingredients: inventory.filter(row => row.stock_status !== 'Optimal'),
    wastage: { ingredient: waste.filter(row => row.raw_material_id), finished: waste.filter(row => !row.raw_material_id) },
    today_revenue: today.revenue, today_revenue_formatted: `₹${today.revenue}`, monthly_revenue: revenue,
    monthly_revenue_formatted: `₹${revenue}`, average_order_value: summary.average_order_value, gross_margin_percent: summary.gross_margin_percent };
}
module.exports = { getAnalytics };
