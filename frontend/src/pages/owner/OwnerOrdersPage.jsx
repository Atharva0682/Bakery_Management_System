import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox, ChefHat, PackageCheck, Truck, Search, ArrowUpRight, ArrowRight, Image as ImageIcon } from 'lucide-react';
import ownerService from '../../services/ownerService';
import api from '../../services/api';
import usePolling from '../../hooks/usePolling';
import { PageHeader, RefreshButton, MetricStrip, StatusBadge, Notice, EmptyState, Dialog, money, quantity, dateLabel, listOf } from '../../components/owner/OwnerUI';

const isCancelled = order => ['Cancelled', 'Rejected'].includes(order.order_status) || order.payment_status === 'Rejected';
const isReady = order => ['Product Completed', 'Product Packed', 'Product Completed & Packed', 'Packaging', 'Packaged', 'Completed', 'Out for Delivery'].includes(order.order_status);
const needsReview = order => !isCancelled(order) && order.order_status !== 'Delivered' && (order.payment_status === 'Pending Verification' || order.order_status === 'Order Placed');
const reasons = ['Transaction could not be verified', 'Amount received is incorrect', 'Duplicate transaction reference', 'Customer requested cancellation', 'Other'];
export default function OwnerOrdersPage() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refresh } = usePolling(async () => listOf(await ownerService.getAllOrders()), 30000);
  const orders = data || [], view = params.get('view') || 'all', selected = orders.find(order => String(order.id) === params.get('order'));
  const [search, setSearch] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [actionError, setActionError] = useState('');
  const [reject, setReject] = useState(null), [reason, setReason] = useState(reasons[0]), [note, setNote] = useState(''), [proofOpen, setProofOpen] = useState(false);
  const setParam = (key, value) => setParams(previous => { const next = new URLSearchParams(previous); value ? next.set(key, value) : next.delete(key); return next; });
  const tabs = [
    ['all', 'All orders', () => true], ['review', 'Needs review', needsReview],
    ['preparing', 'Preparing', order => !isCancelled(order) && !needsReview(order) && !isReady(order) && order.order_status !== 'Delivered'],
    ['ready', 'Ready', order => !isCancelled(order) && isReady(order)], ['delivered', 'Delivered', order => order.order_status === 'Delivered'], ['cancelled', 'Cancelled', isCancelled],
  ];
  const filter = tabs.find(([key]) => key === view)?.[2] || tabs[0][2];
  const filtered = orders.filter(order => filter(order) && `${order.order_no} ${order.customer_name || ''} ${order.guest_name || ''} ${order.transaction_id || ''}`.toLowerCase().includes(search.toLowerCase()));
  const run = async (action, success) => {
    setBusy(true); setActionError(''); setNotice('');
    try { await action(); await refresh(); setNotice(success); return true; }
    catch (error) { setActionError(error.message); return false; } finally { setBusy(false); }
  };
  const advance = (order, status) => run(() => ownerService.updateOrderStatus(order.id, status, `Owner advanced order to ${status}`), `Order ${order.order_no} updated.`);
  const rejectPayment = async event => {
    event.preventDefault();
    const success = await run(() => api.patch(`/orders/${reject.id}/reject-payment`, { reason: note.trim() ? `${reason}: ${note.trim()}` : reason }), 'Payment review saved.');
    if (success) setReject(null);
  };
  const proof = selected?.screenshot_data || selected?.payment?.screenshot_data || selected?.screenshot || selected?.payment_screenshot;
  const proofSrc = typeof proof === 'string' && /^(data:image\/(png|jpeg|jpg|webp);base64,|https?:\/\/)/i.test(proof) ? proof : null;
  const nextAction = selected && !isCancelled(selected) && selected.payment_status !== 'Pending Verification' && selected.order_status !== 'Delivered'
    ? selected.order_status === 'Order Placed' ? ['Accept order', 'Accepted']
      : ['Accepted', 'Preparation', 'Proofing'].includes(selected.order_status) ? ['Start production', 'In Production']
      : ['In Production', 'Baking', 'Cooling', 'Quality Check'].includes(selected.order_status) ? ['Mark production complete', 'Product Completed']
      : selected.order_status === 'Product Completed' ? ['Mark packed', 'Product Completed & Packed']
      : isReady(selected) ? ['Mark delivered / collected', 'Delivered'] : null : null;
  return <div className="owner-workspace ow-orders">
    <PageHeader eyebrow="Orders" title="Orders" description="Review payments, follow preparation, and keep customer orders moving."><RefreshButton loading={loading} onClick={refresh} /></PageHeader>
    <Notice error>{error?.message || (!selected && actionError)}</Notice><Notice>{notice}</Notice>
    <MetricStrip items={[
      { icon: Inbox, label: 'Awaiting review', value: data ? orders.filter(needsReview).length : '—', note: 'Payment or order acceptance' },
      { icon: ChefHat, label: 'Being prepared', value: data ? orders.filter(tabs[2][2]).length : '—', note: 'Accepted and with the kitchen' },
      { icon: PackageCheck, label: 'Ready for handover', value: data ? orders.filter(order => !isCancelled(order) && isReady(order)).length : '—', note: 'Production complete or packed' },
      { icon: Truck, label: 'Delivered', value: data ? orders.filter(order => order.order_status === 'Delivered').length : '—', note: 'Customer handover recorded' },
    ]} />
    <div className="ow-toolbar"><div className="ow-tabs" role="tablist" aria-label="Order views">{tabs.map(([key, label, predicate]) => <button role="tab" aria-selected={view === key} key={key} onClick={() => setParam('view', key)}>{label}<span>{orders.filter(predicate).length}</span></button>)}</div><label className="ow-search"><Search size={15} /><input aria-label="Search orders" placeholder="Order, customer, or payment reference…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    <section className="ow-panel">
      {filtered.length ? <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>Order</th><th>Customer</th><th>Fulfilment</th><th>Payment</th><th>Status</th><th className="ow-numeric">Total</th><th /></tr></thead><tbody>{filtered.map(order => <tr key={order.id}><td><button className="ow-row-link" onClick={() => { setActionError(''); setParam('order', String(order.id)); }}><strong className="ow-order-id">{order.order_no || `#${order.id}`}</strong><small>{dateLabel(order.created_at, true)}</small></button></td><td><strong>{order.customer_name || order.guest_name || 'Guest customer'}</strong><small>{order.items?.length ? `${(order.items || []).reduce((sum, item) => sum + Number(item.quantity), 0)} items` : 'Items not recorded'}</small></td><td style={{ textTransform: 'capitalize' }}>{order.order_type?.replace('_', ' ') || '—'}<small>{order.delivery_date ? dateLabel(order.delivery_date) : 'Not scheduled'}</small></td><td><StatusBadge value={order.payment_status} /><small>{order.payment_method === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : 'UPI'}</small></td><td><StatusBadge value={order.order_status === 'Completed' ? 'Production complete' : order.order_status} /></td><td className="ow-numeric"><strong>{money(order.total_amount)}</strong></td><td><button className="ow-icon-button" aria-label={`View order ${order.order_no || order.id}`} onClick={() => { setActionError(''); setParam('order', String(order.id)); }}><ArrowUpRight size={16} /></button></td></tr>)}</tbody></table></div> : <EmptyState title={loading && !data ? 'Loading your orders…' : 'No orders in this view'}>Try a different filter or search. New customer orders will appear here.</EmptyState>}
    </section><div className="ow-footer-note"><span>{filtered.length} of {orders.length} orders</span><span>Updates every 30 seconds while this page is visible</span></div>
    {selected && !reject && !proofOpen && <Dialog title={selected.order_no || `Order #${selected.id}`} description={`Placed ${dateLabel(selected.created_at, true)}`} onClose={() => setParam('order', null)} footer={<><button className="ow-button" onClick={() => setParam('order', null)}>Close</button>{nextAction && <button disabled={busy} className="ow-button ow-button-primary" onClick={() => advance(selected, nextAction[1])}>{busy ? 'Saving…' : nextAction[0]}<ArrowRight size={14} /></button>}</>}>
      <Notice error>{actionError}</Notice><div className="ow-actions" style={{ marginBottom: 24 }}><StatusBadge value={selected.order_status === 'Completed' ? 'Production complete' : selected.order_status} /><StatusBadge value={selected.payment_status} /></div>
      <div className="ow-form-grid"><div className="ow-detail-block"><h3>Customer</h3><p><strong>{selected.customer_name || selected.guest_name || 'Guest customer'}</strong></p><p className="ow-muted">{selected.customer_phone || selected.guest_phone || 'No phone saved'}</p></div><div className="ow-detail-block"><h3>Fulfilment</h3><p style={{ textTransform: 'capitalize' }}>{selected.order_type?.replace('_', ' ')}</p><p className="ow-muted">{selected.delivery_date ? dateLabel(selected.delivery_date) : 'Date not specified'}{selected.delivery_time_slot ? ` · ${selected.delivery_time_slot}` : ''}</p></div></div>
      <div className="ow-detail-block"><h3>Order items</h3>{(selected.items || []).length ? selected.items.map((item, index) => <div className="ow-key-value" key={item.id || index}><div><strong>{item.product_name || item.name}</strong><div className="ow-muted ow-small">{quantity(item.quantity)} × {money(item.unit_price)}{item.variant_name && item.variant_name !== 'Standard' ? ` · ${item.variant_name}` : ''}</div></div><strong>{money(item.subtotal)}</strong></div>) : <p className="ow-muted">Item details were not recorded for this historical order.</p>}</div>
      <div className="ow-detail-block"><div className="ow-key-value"><span>Subtotal</span><strong>{money(selected.subtotal)}</strong></div><div className="ow-key-value"><span>GST</span><strong>{money(selected.tax_amount)}</strong></div><div className="ow-key-value"><span>Delivery</span><strong>{money(selected.delivery_fee)}</strong></div>{Number(selected.discount_amount) > 0 && <div className="ow-key-value"><span>Discount</span><strong>−{money(selected.discount_amount)}</strong></div>}<div className="ow-key-value ow-key-value-total"><span>Order total</span><strong>{money(selected.total_amount)}</strong></div></div>
      {selected.special_instructions && <div className="ow-detail-block"><h3>Order notes</h3><p>{selected.special_instructions}</p></div>}
      <div className="ow-detail-block"><h3>Payment</h3><p>{selected.payment_method === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : 'UPI transfer'}</p>{selected.transaction_id && <p className="ow-order-id">Reference: {selected.transaction_id}</p>}{proofSrc && <button className="ow-button" onClick={() => setProofOpen(true)}><ImageIcon size={15} />View payment proof</button>}
        {selected.payment_status === 'Pending Verification' && !isCancelled(selected) && <><p className="ow-muted ow-small">Check the transfer against your bank records before approval.</p><div className="ow-actions"><button className="ow-button ow-button-primary" disabled={busy} onClick={() => run(() => api.patch(`/orders/${selected.id}/approve-payment`), 'Payment approved and order accepted.')}>Approve payment</button><button className="ow-button ow-button-danger" disabled={busy} onClick={() => { setReason(reasons[0]); setNote(''); setReject(selected); setActionError(''); }}>Reject payment</button></div></>}
        {selected.payment_method === 'CASH_ON_DELIVERY' && selected.payment_status === 'Unpaid' && !isCancelled(selected) && <button className="ow-button" disabled={busy} onClick={() => { if (window.confirm(`Record receipt of ${money(selected.total_amount)} in cash for ${selected.order_no}?`)) run(() => api.patch(`/orders/${selected.id}/collect-payment`, { amount: Number(selected.total_amount) }), 'Cash payment recorded.'); }}>Record cash received · {money(selected.total_amount)}</button>}
      </div>{selected.rejection_reason && <Notice error>{selected.rejection_reason}</Notice>}
    </Dialog>}
    {reject && <Dialog title="Reject payment" description={reject.order_no} onClose={() => setReject(null)} footer={<><button className="ow-button" onClick={() => setReject(null)}>Go back</button><button disabled={busy} className="ow-button ow-button-danger" form="reject-payment" type="submit">Confirm rejection</button></>}><form id="reject-payment" className="ow-form" onSubmit={rejectPayment}><Notice error>{actionError}</Notice><label className="ow-field">Reason<select value={reason} onChange={event => setReason(event.target.value)}>{reasons.map(item => <option key={item}>{item}</option>)}</select></label><label className="ow-field">Additional notes<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Include any details the customer should know." /></label></form></Dialog>}
    {proofOpen && selected && <Dialog title="Payment proof" description={selected.order_no} onClose={() => setProofOpen(false)} wide><img className="ow-proof" style={{ maxHeight: '65vh' }} src={proofSrc} alt={`Uploaded payment proof for ${selected.order_no}`} /></Dialog>}
  </div>;
}
