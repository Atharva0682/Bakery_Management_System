process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'verification-only-secret-not-for-production';
const path = require('node:path');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
(async () => {
  const source = new Database(path.join(__dirname, '..', 'bakery.pre-audit.sqlite'), { readonly: true });
  const destination = path.join(__dirname, '..', `verification-${Date.now()}.sqlite`);
  await source.backup(destination); source.close();
  process.env.SQLITE_DB_PATH = destination;
  const db = require('../src/config/db');
  const recipes = require('../src/models/recipeRepository');
  const inventory = require('../src/models/inventoryRepository');
  const orderService = require('../src/services/orderService');
  const production = require('../src/services/productionInventoryService');
  const wastage = require('../src/models/wastageRepository');
  const security = require('../src/utils/security');
  const { convertQuantity } = require('../src/utils/costing');
  let passed = 0;
  async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
  try {
    await check('password bypass rejected', async () => {
      const hash = await security.hashPassword('a-different-password');
      assert.equal(await security.comparePassword('Password@123', hash), false);
      assert.equal(await security.comparePassword('a-different-password', hash), true);
    });
    await check('unit compatibility and conversion', async () => {
      assert.equal(convertQuantity(500, 'g', 'kg'), 0.5);
      assert.equal(convertQuantity(750, 'ml', 'L'), 0.75);
      assert.throws(() => convertQuantity(1, 'kg', 'L'));
    });
    const all = await recipes.getAllRecipes(1); const recipe = all[0];
    const owner = (await db.query("SELECT * FROM users WHERE business_id = 1 AND role = 'owner' LIMIT 1")).rows[0];
    const customer = (await db.query("SELECT * FROM users WHERE business_id = 1 AND role = 'customer' LIMIT 1")).rows[0];
    await check('existing 25 recipes load with database costing', async () => {
      assert.equal(all.length, 25); assert.ok(recipe.ingredients.length);
      assert.equal(recipe.total_cost, Math.round((recipe.raw_material_cost + recipe.labour_cost + recipe.power_cost + recipe.packaging_cost + recipe.other_cost) * 100) / 100);
    });
    await check('recipe tenant write/delete isolation', async () => {
      await assert.rejects(recipes.updateRecipe(recipe.id, { recipe_name: 'tampered' }, 999));
      await assert.rejects(recipes.deleteRecipe(recipe.id, 999));
      assert.equal((await recipes.getAllRecipes(1))[0].ingredients.length, recipe.ingredients.length);
    });
    await check('recipe edit persists ingredients, zero rates and yield', async () => {
      await recipes.updateRecipe(recipe.id, { ingredients: recipe.ingredients.map(i => ({ ...i, quantity: i.quantity * 2 })), labour_cost_per_min: 0, batch_yield_units: 10, gst_rate: 12 }, 1);
      const updated = (await recipes.getAllRecipes(1))[0];
      assert.equal(updated.ingredients[0].quantity, recipe.ingredients[0].quantity * 2);
      assert.equal(updated.labour_cost, 0); assert.equal(updated.yield_quantity, 10);
      await assert.rejects(recipes.updateRecipe(recipe.id, { ingredients: [{ raw_material_id: recipe.ingredients[0].raw_material_id, quantity: 1, unit: 'L' }], selling_price: 1 }, 1));
      assert.equal((await recipes.getAllRecipes(1))[0].selling_price, recipe.selling_price);
      await recipes.updateRecipe(recipe.id, { batch_yield_units: recipe.batch_yield_units, ingredients: recipe.ingredients, labour_cost_per_min: recipe.labour_cost_per_min }, 1);
    });
    let order;
    await check('create persisted pickup order with tax and cost snapshots', async () => {
      order = await orderService.createCustomerOrder({ customerId: customer.id, businessId: 1, orderData: { order_type: 'pickup', payment_method: 'CASH_ON_DELIVERY', items: [{ product_id: recipe.product_id, quantity: 1 }] } });
      assert.ok(order.id); assert.equal(order.delivery_fee, 0); assert.ok(order.items[0].cost_snapshot);
      assert.equal(order.tax_amount, Math.round(order.subtotal * 12) / 100);
    });
    const needed = await production.requirements('order', order.id, 1);
    for (const item of needed) await inventory.updateStock(item.raw_material_id, item.quantity + 1, { businessId: 1, isDeduction: false });
    const before = await inventory.getIngredientById(needed[0].raw_material_id, 1);
    await check('accept reserves without stock deduction', async () => {
      await orderService.updateOrderStatus(order.id, 'Accepted', 'Verification', owner.id, 1);
      const after = await inventory.getIngredientById(before.id, 1);
      assert.equal(Number(after.current_stock), Number(before.current_stock)); assert.ok(Number(after.reserved_stock) > 0);
    });
    await check('production consumes exactly once across retries', async () => {
      await orderService.updateOrderStatus(order.id, 'In Production', 'Verification', owner.id, 1);
      const once = await inventory.getIngredientById(before.id, 1);
      await orderService.updateOrderStatus(order.id, 'In Production', 'retry', owner.id, 1);
      const twice = await inventory.getIngredientById(before.id, 1);
      assert.equal(Number(once.current_stock), Number(twice.current_stock));
      assert.ok(Math.abs(Number(before.current_stock) - Number(once.current_stock) - needed[0].quantity) < 1e-8);
    });
    await check('order completion creates finished goods and delivery deducts them exactly once', async () => {
      await orderService.updateOrderStatus(order.id, 'Completed', 'Finished production', owner.id, 1);
      const linked = (await db.query('SELECT pb.* FROM production_batches pb JOIN batch_orders bo ON bo.batch_id = pb.id WHERE bo.order_id = $1', [order.id])).rows;
      assert.ok(linked.length); assert.equal(Number(linked[0].actual_usable_qty), Number(linked[0].planned_quantity));
      await orderService.updateOrderStatus(order.id, 'Delivered', 'Collected', owner.id, 1);
      await orderService.updateOrderStatus(order.id, 'Delivered', 'retry', owner.id, 1);
      assert.equal(Number((await db.query('SELECT actual_usable_qty FROM production_batches WHERE id = $1', [linked[0].id])).rows[0].actual_usable_qty), 0);
      assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM finished_goods_movements WHERE order_id = $1', [order.id])).rows[0].n), linked.length);
      await assert.rejects(orderService.updateOrderStatus(order.id, 'Accepted', 'backwards', owner.id, 1));
    });
    await check('historical price and cost survive recipe changes', async () => {
      const stored = (await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id])).rows[0];
      await recipes.updateRecipe(recipe.id, { selling_price: recipe.selling_price + 50, labour_cost_per_min: 15 }, 1);
      const later = (await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id])).rows[0];
      assert.equal(later.unit_price, stored.unit_price); assert.equal(later.cost_snapshot, stored.cost_snapshot); assert.equal(later.gst_rate, 12);
    });
    await check('stock deduction rejects shortages and invalid quantities', async () => {
      const stock = await inventory.getIngredientById(before.id, 1);
      await assert.rejects(inventory.updateStock(before.id, Number(stock.current_stock) + 999, { businessId: 1 }));
      await assert.rejects(inventory.updateStock(before.id, -1, { businessId: 1, isDeduction: false }));
      assert.equal(Number((await inventory.getIngredientById(before.id, 1)).current_stock), Number(stock.current_stock));
    });
    await check('ingredient wastage atomic deduction and idempotency', async () => {
      const stock = await inventory.getIngredientById(before.id, 1);
      const data = { business_id: 1, raw_material_id: stock.id, quantity_wasted: 0.01, unit: stock.unit, reason: 'Verification spill', baker_id: owner.id, idempotency_key: 'verification-waste-1' };
      const row = await wastage.recordWastage(data); const retry = await wastage.recordWastage(data);
      assert.equal(row.id, retry.id);
      assert.ok(Math.abs(Number((await inventory.getIngredientById(before.id, 1)).current_stock) - Number(stock.current_stock) + 0.01) < 1e-8);
      assert.equal(row.cost_loss, Math.round(0.01 * stock.cost_per_unit * 100) / 100);
    });
    await check('transaction rolls back persisted writes on failure', async () => {
      const stock = await inventory.getIngredientById(before.id, 1);
      await assert.rejects(db.transaction(async () => { await db.query('UPDATE raw_materials SET current_stock = 0 WHERE id = $1', [before.id]); throw new Error('forced rollback'); }));
      assert.equal(Number((await inventory.getIngredientById(before.id, 1)).current_stock), Number(stock.current_stock));
    });
    await check('all reporting periods use stored records and flag missing historical costs', async () => {
      const analytics = require('../src/services/analyticsService');
      for (const range of ['this_week', 'this_month', 'quarterly', 'half_yearly', 'yearly']) {
        const result = await analytics.getAnalytics(1, range);
        assert.ok(result.daily_trend.length > 0);
        if (result.summary.historical_items_missing_cost) assert.equal(result.summary.net_profit, null);
      }
    });
    await check('concurrent acceptance prevents overselling and rolls back the blocked order', async () => {
      const make = () => orderService.createCustomerOrder({ customerId: customer.id, businessId: 1, orderData: { order_type: 'pickup', payment_method: 'CASH_ON_DELIVERY', items: [{ product_id: recipe.product_id, quantity: 1 }] } });
      const first = await make(), second = await make();
      const required = await production.requirements('order', first.id, 1);
      for (const row of required) await db.query('UPDATE raw_materials SET current_stock = $1 WHERE id = $2 AND business_id = 1', [row.quantity, row.raw_material_id]);
      const outcomes = await Promise.allSettled([orderService.updateOrderStatus(first.id, 'Accepted', 'parallel', owner.id, 1), orderService.updateOrderStatus(second.id, 'Accepted', 'parallel', owner.id, 1)]);
      assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
      const blocked = outcomes[0].status === 'rejected' ? first : second;
      assert.equal((await db.query('SELECT order_status FROM orders WHERE id = $1', [blocked.id])).rows[0].order_status, 'Order Placed');
    });
    await check('finished wastage deducts stored batch stock without retry restoration', async () => {
      const batches = require('../src/models/batchRepository');
      const batch = await batches.createBatch({ business_id: 1, product_id: recipe.product_id, planned_quantity: 2 });
      const required = await production.requirements('batch', batch.id, 1);
      for (const row of required) await inventory.updateStock(row.raw_material_id, row.quantity + 5, { businessId: 1, isDeduction: false });
      await batches.updateStatus(batch.id, 'In Production', { businessId: 1 });
      await batches.updateStatus(batch.id, 'Completed', { businessId: 1, completedQuantity: 2 });
      await wastage.recordWastage({ business_id: 1, batch_id: batch.id, quantity_wasted: 1, unit: 'pcs', reason: 'Damaged', baker_id: owner.id, idempotency_key: 'finished-1' });
      await batches.updateStatus(batch.id, 'Completed', { businessId: 1, completedQuantity: 2 });
      assert.equal(Number((await batches.getBatchById(batch.id, 1)).actual_usable_qty), 1);
    });
    const app = require('../src/server');
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const token = security.generateToken(owner);
    const request = async (route, method = 'GET', body, auth = token, headers = {}) => {
      const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, headers: response.headers, data: await response.json() };
    };
    try {
      await check('HTTP team onboarding and editing persist the configured wage and role', async () => {
        const created = await request('/owner/workers', 'POST', { name: 'UI verification teammate', email: 'ui-verification-teammate@example.invalid', role: 'baker', daily_wage: 1376.24, shift_name: 'Verification shift', shift_start: '05:00', shift_end: '13:00' });
        assert.equal(created.status, 201);
        const member = created.data.data.user;
        assert.ok(created.data.data.temporary_password);
        const readTeam = async () => (await request('/owner/workers')).data.data.workers;
        assert.equal((await readTeam()).find(row => row.id === member.id).daily_wage, 1376.24);
        assert.equal((await request(`/owner/workers/${member.id}`, 'PUT', { name: 'Edited verification teammate', role: 'staff', daily_wage: 1488 })).status, 200);
        const saved = (await readTeam()).find(row => row.id === member.id);
        assert.equal(saved.name, 'Edited verification teammate'); assert.equal(saved.raw_role, 'staff'); assert.equal(saved.daily_wage, 1488);
        const editedUser = (await db.query('SELECT shift, shift_name, shift_start, shift_end FROM users WHERE id = $1', [member.id])).rows[0];
        assert.equal(editedUser.shift, member.shift); assert.equal(editedUser.shift_name, 'Verification shift'); assert.equal(editedUser.shift_start, '05:00'); assert.equal(editedUser.shift_end, '13:00');
        assert.equal((await request('/owner/workers', 'POST', { name: 'Duplicate', email: member.email, role: 'baker', daily_wage: 1000 })).status, 409);
        const customerToken = security.generateToken(customer);
        assert.equal((await request(`/owner/workers/${member.id}`, 'PUT', { daily_wage: 1 }, customerToken)).status, 403);
        await db.query('DELETE FROM users WHERE id = $1', [member.id]);
      });
      await check('HTTP branding round trip exposes saved nested contact, palette and payment fields', async () => {
        const original = (await db.query('SELECT * FROM businesses WHERE id = $1', [owner.business_id])).rows[0];
        const changed = { name: 'Verification brand', tagline: 'Saved studio tagline', primary_color: '#213645', secondary_color: '#8B5A2B', accent_color: '#D96C8A', logo_url: '/assets/logos/crumbandco.svg', contact_email: 'studio@example.invalid', contact_phone: '1234567890', address_line1: 'Verification street', city: 'Verification city', postal_code: '123456', fssai_license: '', upi_vpa: 'verification@bank', upi_qr_image: '' };
        assert.equal((await request('/business/branding', 'PUT', changed)).status, 200);
        const profile = (await request(`/business/${original.slug}`)).data.data;
        assert.equal(profile.name, changed.name); assert.equal(profile.tagline, changed.tagline); assert.equal(profile.branding.primaryColor, changed.primary_color);
        assert.equal(profile.contact.email, changed.contact_email); assert.equal(profile.address.line1, changed.address_line1); assert.equal(profile.upiVpa, changed.upi_vpa);
        assert.equal((await request('/business/branding', 'PUT', original)).status, 200);
      });
      await check('HTTP delivery pricing persists independently of business identity', async () => {
        const original = (await request('/owner/settings/pricing')).data.data;
        const nameBefore = (await db.query('SELECT name FROM businesses WHERE id = $1', [owner.business_id])).rows[0].name;
        assert.equal((await request('/owner/settings/pricing', 'PATCH', { delivery_fee: 38, free_delivery_threshold: 475, delivery_gst_rate: 0 })).status, 200);
        const saved = (await request('/owner/settings/pricing')).data.data;
        assert.equal(Number(saved.delivery_fee), 38); assert.equal(Number(saved.free_delivery_threshold), 475); assert.equal(Number(saved.delivery_gst_rate), 0);
        assert.equal((await db.query('SELECT name FROM businesses WHERE id = $1', [owner.business_id])).rows[0].name, nameBefore);
        assert.equal((await request('/owner/settings/pricing', 'PATCH', { ...saved, delivery_fee: -1 })).status, 400);
        assert.equal((await request('/owner/settings/pricing', 'PATCH', original)).status, 200);
      });
      await check('HTTP health, authorization and tenant isolation', async () => {
        assert.equal((await request('/health')).status, 200);
        assert.equal((await request('/recipes', 'GET', undefined, null)).status, 401);
        const customerToken = security.generateToken(customer);
        assert.equal((await request(`/recipes/${recipe.id}`, 'PUT', { selling_price: 1 }, customerToken)).status, 403);
        assert.equal((await request(`/recipes/${recipe.id}`, 'PUT', { selling_price: 1, business_id: 999 })).status, 200);
        const alien = (await db.query('SELECT * FROM users WHERE business_id = 2 LIMIT 1')).rows[0];
        if (alien) assert.notEqual((await request(`/recipes/${recipe.id}`, 'PUT', { selling_price: 999 }, security.generateToken(alien))).status, 200);
      });
      await check('HTTP invalid product recipe rolls back product and default variant', async () => {
        const count = Number((await db.query('SELECT COUNT(*) AS n FROM products')).rows[0].n);
        const category = (await db.query('SELECT id FROM categories WHERE business_id = 1 LIMIT 1')).rows[0];
        const result = await request('/products', 'POST', { name: 'Atomic verification product', category_id: category.id, base_price: 5, recipe: { recipe_name: 'Invalid', ingredients: [] } });
        assert.equal(result.status, 400);
        assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM products')).rows[0].n), count);
      });
      await check('HTTP bulk edit rolls back on a foreign recipe', async () => {
        const before = (await recipes.getAllRecipes(1))[0].power_cost_per_min;
        const result = await request('/recipes/bulk', 'POST', { ids: [recipe.id, 999999], changes: { power_cost_per_min: 99 } });
        assert.equal(result.status, 400);
        assert.equal((await recipes.getAllRecipes(1))[0].power_cost_per_min, before);
      });
      await check('HTTP percentage threshold uses fixed reference and handles zero', async () => {
        const result = await request(`/ingredients/${before.id}/policy`, 'PATCH', { threshold_mode: 'percentage', reference_stock: 100, threshold_percent: 30 });
        assert.equal(result.status, 200);
        assert.equal((await inventory.getIngredientById(before.id, 1)).minimum_stock, 30);
        const zero = await request(`/ingredients/${before.id}/policy`, 'PATCH', { threshold_mode: 'absolute', reference_stock: 0, min_reorder_level: 0 });
        assert.equal(zero.status, 200); assert.equal((await inventory.getIngredientById(before.id, 1)).minimum_stock, 0);
      });
      await check('HTTP product and recipe CRUD persists a complete formulation', async () => {
        const category = (await db.query('SELECT id FROM categories WHERE business_id = 1 LIMIT 1')).rows[0];
        const created = await request('/products', 'POST', { name: 'Complete verification recipe', category_id: category.id, base_price: 20, recipe: { recipe_name: 'Verification formulation', batch_yield_units: 2, prep_time_mins: 3, bake_time_mins: 4, labour_cost_per_min: 0, power_cost_per_min: 0, packaging_cost_per_unit: 0, ingredients: recipe.ingredients } });
        assert.equal(created.status, 201);
        const product = created.data.data.product, saved = created.data.data.recipe;
        const fetched = (await recipes.getAllRecipes(1)).find(row => row.id === saved.id);
        assert.equal(fetched.labour_cost, 0); assert.equal(fetched.yield_quantity, 2); assert.equal(fetched.ingredients.length, recipe.ingredients.length);
        assert.equal((await request(`/recipes/${saved.id}`, 'DELETE')).status, 200);
        assert.equal((await request(`/products/${product.id}`, 'DELETE')).status, 200);
        assert.equal(Number((await db.query('SELECT is_available FROM products WHERE id = $1', [product.id])).rows[0].is_available), 0);
      });
      await check('HTTP delivery config applies once to a multi-item order and preserves totals', async () => {
        assert.equal((await request('/owner/settings/pricing', 'PATCH', { delivery_fee: 25, free_delivery_threshold: 500, delivery_gst_rate: 18 })).status, 200);
        const created = await orderService.createCustomerOrder({ customerId: customer.id, businessId: 1, orderData: { order_type: 'delivery', payment_method: 'CASH_ON_DELIVERY', items: [{ product_id: recipe.product_id, quantity: 1 }, { product_id: recipe.product_id, quantity: 2 }] } });
        assert.equal(created.delivery_fee, 25);
        assert.equal(created.tax_amount, Math.round(created.subtotal * 12) / 100 + 4.5);
        assert.equal(created.total_amount, Math.round((created.subtotal + 25 + created.tax_amount) * 100) / 100);
      });
      await check('traceability rejects invented references', async () => {
        await assert.rejects(require('../src/models/ownerRepository').getTraceability('NONEXISTENT-REFERENCE', 1));
      });
      await check('cash collection is idempotent and reporting excludes GST from revenue', async () => {
        const analytic = require('../src/services/analyticsService');
        const beforeRevenue = (await analytic.getAnalytics(1, 'today')).summary.revenue;
        assert.equal((await request(`/orders/${order.id}/collect-payment`, 'PATCH', { amount: Number(order.total_amount) })).status, 200);
        assert.equal((await request(`/orders/${order.id}/collect-payment`, 'PATCH', { amount: Number(order.total_amount) })).status, 200);
        const after = await analytic.getAnalytics(1, 'today');
        assert.equal(after.summary.revenue - beforeRevenue, Number(order.subtotal));
        assert.ok(after.summary.customer_receipts > after.summary.revenue);
        assert.equal(after.summary.costs_complete, true); assert.ok(Number.isFinite(after.summary.net_profit));
        assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM order_status_history WHERE order_id = $1 AND notes = 'Owner recorded full cash payment collection'", [order.id])).rows[0].n), 1);
      });
      await check('owner batch creation saves the selected baker and rejects a foreign worker', async () => {
        const baker = (await db.query("SELECT id FROM users WHERE business_id = 1 AND role = 'baker' AND is_active = true LIMIT 1")).rows[0];
        const created = await request('/batches', 'POST', { product_id: recipe.product_id, planned_quantity: 1, baker_id: baker.id });
        assert.equal(created.status, 201); assert.equal(Number(created.data.data.baker_id), Number(baker.id));
        const foreign = (await db.query('SELECT id FROM users WHERE business_id = 2 LIMIT 1')).rows[0];
        if (foreign) { const invalid = await request('/batches', 'POST', { product_id: recipe.product_id, planned_quantity: 1, baker_id: foreign.id }); assert.equal(invalid.status, 400); }
      });
      await check('HTTP disallowed CORS origin gets no credential access', async () => {
        const result = await request('/health', 'GET', undefined, null, { Origin: 'https://untrusted.example' });
        assert.equal(result.headers.get('access-control-allow-origin'), null);
      });
    } finally { await new Promise(resolve => server.close(resolve)); }
    console.log(`RESULT ${passed} checks passed; isolated existing-record database: ${destination}`);
  } finally { await db.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
