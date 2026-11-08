import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ownerService from '../../services/ownerService';
import usePolling from '../../hooks/usePolling';
import { PageHeader, RefreshButton, MetricStrip, SectionHeader, EmptyState, Notice, money, quantity, unwrap } from '../../components/owner/OwnerUI';
const periods = [['this_week', 'Weekly'], ['this_month', 'Monthly'], ['quarterly', 'Quarterly'], ['half_yearly', 'Half-yearly'], ['yearly', 'Yearly']];
export default function OwnerAnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const range = periods.some(([key]) => key === params.get('period')) ? params.get('period') : 'this_week';
  return <AnalyticsView key={range} range={range} setRange={value => setParams(previous => { const next = new URLSearchParams(previous); next.set('period', value); return next; })} />;
}
function AnalyticsView({ range, setRange }) {
  const { data: analytics, loading, error, refresh } = usePolling(async () => unwrap(await ownerService.getAnalytics({ range })), 60000);
  const summary = analytics?.summary, trend = analytics?.daily_trend || [], products = analytics?.top_products || [];
  const hasActivity = trend.some(day => Number(day.revenue) > 0), maximum = Math.max(1, ...trend.map(day => Number(day.revenue) || 0));
  const costs = [['Ingredients', 'material_cost'], ['Labour', 'labor_cost'], ['Electricity', 'power_cost'], ['Packaging', 'packaging_cost'], ['Other production costs', 'other_cost'], ['Wastage', 'wastage_loss']];
  return <div className="owner-workspace ow-sales">
    <PageHeader eyebrow="Reports / sales & costs" title="Sales & profitability" description="A clear account of sales, production costs, and what remains.">
      <select className="ow-select" aria-label="Reporting period" value={range} onChange={event => setRange(event.target.value)}>{periods.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><RefreshButton loading={loading} onClick={refresh} />
    </PageHeader>
    <div className="ow-footer-note"><span>{analytics?.period_label || 'Loading reporting period…'}</span><span>Revenue includes paid orders only</span></div>
    <Notice error>{error?.message}</Notice>
    {(analytics?.alerts || []).map((alert, index) => <Notice key={index}>{alert.text}</Notice>)}
    <MetricStrip items={[
      { label: 'Revenue', value: money(summary?.revenue), note: 'Sales + delivery, excluding GST' },
      { label: 'Orders', value: summary?.total_orders, note: summary ? `${summary.orders_count} paid · ${quantity(summary.units_sold)} items sold` : '—' },
      { label: 'Net profit', value: money(summary?.net_profit), note: summary?.net_profit == null ? 'Historical costs incomplete' : `${Number(summary.net_margin_percent || 0).toFixed(1)}% net margin` },
      { label: 'Average order', value: money(summary?.average_order_value), note: 'Across paid orders' },
    ]} />
    <section className="ow-panel"><SectionHeader title="Revenue over time" subtitle={analytics?.period_label} /><div className="ow-chart">
      {hasActivity ? <><div className="ow-chart-bars" role="img" aria-label={`Revenue by date for ${analytics?.period_label}`}>{trend.map((day, index) => <div className="ow-chart-column" key={day.date || index}><span className="ow-chart-value">{day.revenue > 0 ? money(day.revenue) : '—'}</span><div className="ow-chart-bar" title={`${day.date}: ${money(day.revenue)}, ${day.orders} orders`} style={{ height: `${Math.max(1, Number(day.revenue) / maximum * 130)}px`, opacity: day.revenue ? 1 : .18 }} /><span className="ow-chart-label">{trend.length > 20 ? day.date?.slice(-2) : day.day}</span></div>)}</div><p className="ow-chart-caption">{trend.length > 20 ? 'Daily' : 'Period'} revenue · Tax is shown separately from revenue.</p></> : <EmptyState title={loading ? 'Loading sales…' : 'No paid sales in this period'}>Choose a different period to review earlier activity.</EmptyState>}
    </div></section>
    <div className="ow-cost-grid">
      <section className="ow-panel"><SectionHeader title="The cost of each bake" subtitle="Production costs and recorded losses" /><div className="ow-statement">{costs.map(([label, key]) => <div className="ow-cost-row" key={key}><span>{label}</span><strong>{money(summary?.[key])}</strong></div>)}<div className="ow-cost-row ow-cost-row-total"><span>Net profit</span><strong>{money(summary?.net_profit)}</strong></div><p className="ow-muted ow-small">{summary?.costs_complete ? 'Revenue less production costs and wastage.' : 'Only saved costs are included. Profit remains unavailable when historical records are incomplete.'}</p></div></section>
      <section className="ow-panel"><SectionHeader title="Sales & charges" subtitle="The rest of your financial summary" /><div className="ow-statement">{[['Product sales', 'product_sales'], ['Delivery charges', 'delivery_charges'], ['Discounts', 'discounts'], ['GST collected', 'gst'], ['Customer receipts', 'customer_receipts']].map(([label, key]) => <div className="ow-cost-row" key={key}><span>{label}</span><strong>{money(summary?.[key])}</strong></div>)}<p className="ow-muted ow-small">GST collected is separate from bakery revenue. Delivery is charged at order level.</p></div></section>
    </div>
    <section className="ow-panel"><SectionHeader title="Products, in perspective" subtitle="Units sold and profitability from saved order records" />{products.length ? <div className="ow-table-wrap"><table className="ow-table ow-responsive-table"><thead><tr><th>Product</th><th className="ow-numeric">Units</th><th className="ow-numeric">Sales</th><th className="ow-numeric">Production cost</th><th className="ow-numeric">Profit</th><th className="ow-numeric">Margin</th></tr></thead><tbody>{products.map((product, index) => <tr key={product.name + index}><td data-label="Product"><strong>{product.name}</strong></td><td data-label="Units Sold" className="ow-numeric">{quantity(product.units_sold)}</td><td data-label="Sales" className="ow-numeric">{money(product.revenue)}</td><td data-label="Production Cost" className="ow-numeric">{money(product.cost)}</td><td data-label="Profit" className="ow-numeric">{money(product.profit)}</td><td data-label="Margin" className="ow-numeric">{product.margin === 'Unavailable' ? '—' : product.margin}</td></tr>)}</tbody></table></div> : <EmptyState title="No product sales to show">Sales will appear here once payments are recorded.</EmptyState>}</section>
  </div>;
}
