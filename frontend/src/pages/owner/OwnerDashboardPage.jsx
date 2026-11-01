import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChefHat, ShoppingBag, Package, Wheat } from 'lucide-react';
import ownerService from '../../services/ownerService';
import usePolling from '../../hooks/usePolling';
import { RefreshButton, MetricStrip, SectionHeader, StatusBadge, EmptyState, Notice, money, quantity, listOf, unwrap, terminalOrder } from '../../components/owner/OwnerUI';

export default function OwnerDashboardPage() {
  const { data, loading, error, refresh, lastUpdatedLabel } = usePolling(async () => {
    const [analytics, orders, batches, inventory] = await Promise.all([ownerService.getAnalytics({ range: 'today' }), ownerService.getAllOrders(), ownerService.getBatches(), ownerService.getInventory()]);
    return { analytics: unwrap(analytics), orders: listOf(orders), batches: listOf(batches), inventory: listOf(inventory) };
  }, 30000);
  const orders = data?.orders || [], batches = data?.batches || [], inventory = data?.inventory || [];
  const active = orders.filter(order => !terminalOrder(order));
  const review = orders.filter(order => !terminalOrder(order) && (order.payment_status === 'Pending Verification' || order.order_status === 'Order Placed'));
  const floor = batches.filter(batch => !['Completed', 'Rejected'].includes(batch.status));
  const shortages = inventory.filter(item => ['Low Stock', 'Out of Stock'].includes(item.stock_status));
  const readiness = data?.analytics?.production_overview || [];
  const queue = [...review, ...active.filter(order => !review.some(row => row.id === order.id))].slice(0, 6);
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
  return <div className="owner-workspace ow-dashboard">
    <header className="ow-dashboard-welcome"><div><div className="ow-eyebrow">{today}</div><h1>A fresh look at<br /><em>your bakery.</em></h1><p>From the first order to the final bake, here's where things stand.</p><RefreshButton onClick={refresh} loading={loading} /></div><div className="ow-shift-summary"><Wheat size={96} strokeWidth={.8} aria-hidden="true" /><span>THE KITCHEN NOTEBOOK</span><strong>{data ? quantity(floor.reduce((sum, batch) => sum + Number(batch.planned_quantity), 0)) : '—'}<small>units in the plan</small></strong><p>{floor.length} open batches · {review.length} orders to review</p><Link to="/owner/production">Head to the kitchen<ArrowUpRight size={15} /></Link></div></header>
    <Notice error>{error?.message}</Notice>
    <MetricStrip items={[
      { label: 'Sales today', value: data ? money(data.analytics?.today?.revenue ?? 0) : '—', note: 'Paid orders, excluding GST' },
      { label: 'Open orders', value: data ? active.length : '—', note: 'Includes orders ready for handover' },
      { label: 'On the production floor', value: data ? floor.length : '—', note: `${quantity(floor.reduce((sum, batch) => sum + Number(batch.planned_quantity), 0))} units planned` },
      { label: 'Ingredients to replenish', value: data ? shortages.length : '—', note: 'Available stock below your threshold' },
    ]} />
    <nav className="ow-shortcuts" aria-label="Bakery shortcuts"><Link to="/owner/orders"><ShoppingBag size={20} /><span>Order desk<small>Payments, preparation & handover</small></span><ArrowUpRight size={17} /></Link><Link to="/owner/production"><ChefHat size={20} /><span>Kitchen board<small>Plan & track every batch</small></span><ArrowUpRight size={17} /></Link><Link to="/owner/stock"><Package size={20} /><span>The pantry<small>Ingredients & supplier receipts</small></span><ArrowUpRight size={17} /></Link></nav>
    {review.length > 0 && <div className="ow-attention"><div><strong>{review.length} {review.length === 1 ? 'order needs' : 'orders need'} your attention</strong><p>Review payment or accept the order so the kitchen can begin.</p></div><Link className="ow-text-link" to="/owner/orders?view=review">Review orders<ArrowRight size={14} /></Link></div>}
    <div className="ow-two-column">
      <div className="ow-stack">
        <section className="ow-panel"><SectionHeader title="Order queue" subtitle="What needs to move next"><Link className="ow-text-link" to="/owner/orders">All orders<ArrowUpRight size={14} /></Link></SectionHeader>
          {loading && !data ? <EmptyState title="Loading orders…" /> : queue.length ? <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>Order / customer</th><th>Status</th><th className="ow-numeric">Amount</th><th /></tr></thead><tbody>{queue.map(order => <tr key={order.id}><td><strong className="ow-order-id">{order.order_no || `#${order.id}`}</strong><small>{order.customer_name || order.guest_name || 'Guest customer'}</small></td><td><StatusBadge value={order.payment_status === 'Pending Verification' ? 'Payment review' : order.order_status === 'Completed' ? 'Production complete' : order.order_status} /></td><td className="ow-numeric">{money(order.total_amount)}</td><td><Link className="ow-text-link" to={`/owner/orders?order=${order.id}`} aria-label={`Open order ${order.order_no || order.id}`}><ArrowUpRight size={16} /></Link></td></tr>)}</tbody></table></div> : <EmptyState title="You're all caught up">New orders will appear here when they arrive.</EmptyState>}
        </section>
        <section className="ow-panel"><SectionHeader title="Kitchen progress" subtitle="Current batches and their next steps"><Link className="ow-text-link" to="/owner/production">Open production<ArrowUpRight size={14} /></Link></SectionHeader>
          {floor.length ? floor.slice(0, 4).map(batch => <div className="ow-list-row" key={batch.id}><div><strong>{batch.product_name}</strong><p>{batch.batch_no} · {quantity(batch.planned_quantity)} units · {batch.baker_name || 'Unassigned'}</p></div><StatusBadge value={batch.status} /></div>) : <EmptyState title={loading ? 'Loading production…' : 'The kitchen is clear'}>Plan the next bake from the production workspace.</EmptyState>}
        </section>
      </div>
      <div className="ow-stack">
        <section className="ow-panel"><SectionHeader title="Stock watch" subtitle="Ingredients that need replenishing"><Link className="ow-text-link" to="/owner/stock">Stock<ArrowUpRight size={14} /></Link></SectionHeader>
          {shortages.length ? shortages.slice(0, 5).map(item => <div className="ow-list-row" key={item.id}><div><strong>{item.name}</strong><p>Minimum {quantity(item.minimum_stock)} {item.unit}</p></div><span className="ow-list-number">{quantity(item.available_stock)} <small className="ow-muted ow-small">{item.unit}</small></span></div>) : <EmptyState title={loading ? 'Checking stock…' : 'Stock is within your limits'}>No ingredients are below their configured threshold.</EmptyState>}
        </section>
        <section className="ow-panel"><SectionHeader title="Production readiness" subtitle="Ingredients for pending orders" />
          {readiness.length ? readiness.slice(0, 4).map(order => <div className="ow-list-row" key={order.order_id}><div><strong>{order.order_no}</strong><p>{order.error || (order.ready ? 'Ingredients available' : order.ingredients.filter(item => item.shortage > 0).map(item => `${item.name}: ${quantity(item.shortage)} ${item.unit} short`).join('; '))}</p></div><StatusBadge value={order.ready ? 'Ready' : 'Blocked'} tone={order.ready ? 'success' : 'danger'} /></div>) : <EmptyState title="No pending production orders">Ingredient checks appear here when an order needs production.</EmptyState>}
        </section>
        <div className="ow-attention"><div><strong>The bigger picture</strong><p>Sales, costs, tax, and profitability are together in Reports.</p></div><Link className="ow-text-link" to="/owner/reports" aria-label="View financial reports"><ArrowUpRight size={20} /></Link></div>
      </div>
    </div>
    <div className="ow-footer-note"><span>Updated {lastUpdatedLabel.toLowerCase()}</span><span>Crumb &amp; Co. · Daily overview</span></div>
  </div>;
}
