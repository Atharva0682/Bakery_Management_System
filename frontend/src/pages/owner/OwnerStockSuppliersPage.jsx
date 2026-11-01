import React, { useState } from 'react';
import { Package, AlertTriangle, LockKeyhole, ClipboardList, Search, Plus, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import api from '../../services/api';
import ownerService from '../../services/ownerService';
import staffService from '../../services/staffService';
import usePolling from '../../hooks/usePolling';
import { PageHeader, RefreshButton, MetricStrip, StatusBadge, Notice, EmptyState, Dialog, money, quantity, dateLabel, listOf, unwrap } from '../../components/owner/OwnerUI';

export default function OwnerStockSuppliersPage() {
  const { data, loading, error, refresh } = usePolling(async () => {
    const [inventory, vendorResponse, comparisons, requests, movementsRes] = await Promise.all([ownerService.getInventory(), ownerService.getVendors(), ownerService.getVendorComparisons(), staffService.getRequisitions(), ownerService.getStockMovements().catch(() => [])]);
    const vendors = unwrap(vendorResponse);
    return { ingredients: listOf(inventory), vendors: Array.isArray(vendors) ? vendors : vendors?.vendors || [], comparisons: listOf(comparisons), requests: listOf(requests), movements: listOf(movementsRes) };
  }, 30000);
  const [view, setView] = useState('stock'), [search, setSearch] = useState(''), [category, setCategory] = useState(''), [shortageOnly, setShortageOnly] = useState(false), [requestView, setRequestView] = useState('Pending');
  const [receipt, setReceipt] = useState(null), [policy, setPolicy] = useState(null), [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [message, setMessage] = useState('');
  const [newVendorDialog, setNewVendorDialog] = useState(false), [vendorForm, setVendorForm] = useState({ name: '', contact_name: '', phone: '', email: '', lead_time_days: 1 });
  const ingredients = data?.ingredients || [], vendors = data?.vendors || [], requests = data?.requests || [], movements = data?.movements || [];
  const low = ingredients.filter(item => ['Low Stock', 'Out of Stock'].includes(item.stock_status));
  const categories = [...new Set(ingredients.map(item => item.category).filter(Boolean))];
  const filtered = ingredients.filter(item => (!category || item.category === category) && (!shortageOnly || ['Low Stock', 'Out of Stock'].includes(item.stock_status)) && `${item.name} ${item.sku || ''} ${item.supplier_name || ''}`.toLowerCase().includes(search.toLowerCase()));
  const openReceipt = item => {
    const defaultInputUnit = item ? (['g', 'kg'].includes(item.unit?.toLowerCase()) ? 'kg' : ['ml', 'l'].includes(item.unit?.toLowerCase()) ? 'L' : item.unit) : 'kg';
    setActionError('');
    setReceipt({
      id: item ? String(item.id) : '',
      amount: '',
      inputUnit: defaultInputUnit,
      cost: item ? String(item.cost_per_unit ?? 0) : '',
      supplier: item?.primary_supplier_id ? String(item.primary_supplier_id) : '',
      newSupplierName: '',
      newSupplierContact: '',
      newSupplierPhone: '',
      lot: '',
      expiry: ''
    });
  };
  const material = ingredients.find(item => String(item.id) === receipt?.id);
  const saveReceipt = async event => {
    event.preventDefault(); setBusy(true); setActionError('');
    try {
      let supplierId = receipt.supplier;
      if (supplierId === '__new__') {
        if (!receipt.newSupplierName?.trim()) {
          throw new Error('Please enter the new supplier name');
        }
        const createdVendor = await ownerService.createVendor({
          name: receipt.newSupplierName.trim(),
          contact_name: receipt.newSupplierContact?.trim() || null,
          phone: receipt.newSupplierPhone?.trim() || null
        });
        const unwrapVendor = unwrap(createdVendor);
        supplierId = unwrapVendor?.id ? String(unwrapVendor.id) : '';
      }
      await api.post(`/ingredients/${receipt.id}/restock`, {
        amount: Number(receipt.amount),
        unit: receipt.inputUnit,
        unit_price: Number(receipt.cost),
        ...(supplierId ? { supplier_id: Number(supplierId) } : {}),
        ...(receipt.lot ? { lot_number: receipt.lot } : {}),
        ...(receipt.expiry ? { expiry_date: receipt.expiry } : {})
      });
      setReceipt(null); setMessage('Goods receipt recorded. Stock and purchase cost are updated with automatic unit conversion.'); await refresh();
    } catch (error) { setActionError(error.message); } finally { setBusy(false); }
  };
  const saveNewVendor = async event => {
    event.preventDefault(); setBusy(true); setActionError('');
    try {
      if (!vendorForm.name?.trim()) throw new Error('Supplier name is required');
      await ownerService.createVendor(vendorForm);
      setNewVendorDialog(false);
      setMessage(`Supplier "${vendorForm.name.trim()}" added successfully.`);
      await refresh();
    } catch (err) { setActionError(err.message); } finally { setBusy(false); }
  };
  const formatUnitsDisplay = (qty, unit) => {
    const val = Number(qty || 0);
    const u = (unit || '').toLowerCase();
    if (u === 'kg') {
      if (val >= 1) {
        return {
          primary: `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`,
          secondary: `(${Math.round(val * 1000).toLocaleString()} g)`
        };
      }
      return {
        primary: `${Math.round(val * 1000).toLocaleString()} g`,
        secondary: `(${val.toFixed(3)} kg)`
      };
    }
    if (u === 'g') {
      if (val >= 1000) {
        return {
          primary: `${(val / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`,
          secondary: `(${val.toLocaleString()} g)`
        };
      }
      return {
        primary: `${val.toLocaleString()} g`,
        secondary: null
      };
    }
    if (u === 'l') {
      if (val >= 1) {
        return {
          primary: `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} L`,
          secondary: `(${Math.round(val * 1000).toLocaleString()} mL)`
        };
      }
      return {
        primary: `${Math.round(val * 1000).toLocaleString()} mL`,
        secondary: `(${val.toFixed(3)} L)`
      };
    }
    if (u === 'ml') {
      if (val >= 1000) {
        return {
          primary: `${(val / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} L`,
          secondary: `(${val.toLocaleString()} mL)`
        };
      }
      return {
        primary: `${val.toLocaleString()} mL`,
        secondary: null
      };
    }
    return {
      primary: `${val.toLocaleString()} ${unit || 'pcs'}`,
      secondary: null
    };
  };
  const openThresholdModal = item => {
    setActionError('');
    const u = (item.unit || '').toLowerCase();
    const isWeight = ['kg', 'g'].includes(u);
    const isVolume = ['l', 'ml'].includes(u);
    const inputUnit = isWeight ? 'g' : isVolume ? 'mL' : (item.unit || 'pcs');

    let currentVal = Number(item.minimum_stock ?? item.min_reorder_level ?? 0);
    if (isWeight && u === 'kg') currentVal = Math.round(currentVal * 1000);
    else if (isVolume && u === 'l') currentVal = Math.round(currentVal * 1000);

    setPolicy({
      item,
      minimum: String(currentVal),
      inputUnit
    });
  };
  const handleThresholdUnitChange = newUnit => {
    if (!policy) return;
    const currentVal = parseFloat(policy.minimum);
    if (!Number.isFinite(currentVal) || currentVal <= 0) {
      setPolicy({ ...policy, inputUnit: newUnit });
      return;
    }
    const fromUnit = policy.inputUnit;
    let converted = currentVal;
    if (fromUnit === 'kg' && newUnit === 'g') converted = Math.round(currentVal * 1000);
    else if (fromUnit === 'g' && newUnit === 'kg') converted = Number((currentVal / 1000).toFixed(4));
    else if ((fromUnit === 'L' || fromUnit === 'l') && newUnit === 'mL') converted = Math.round(currentVal * 1000);
    else if (newUnit === 'L' && (fromUnit === 'mL' || fromUnit === 'ml')) converted = Number((currentVal / 1000).toFixed(4));

    setPolicy({
      ...policy,
      minimum: String(converted),
      inputUnit: newUnit
    });
  };
  const savePolicy = async event => {
    event.preventDefault(); setBusy(true); setActionError('');
    try {
      await api.patch(`/ingredients/${policy.item.id}/policy`, {
        threshold_mode: 'absolute',
        minimum_stock: Number(policy.minimum),
        unit: policy.inputUnit
      });
      setPolicy(null);
      setMessage(`Minimum stock threshold for "${policy.item.name}" updated successfully.`);
      await refresh();
    } catch (error) { setActionError(error.message); } finally { setBusy(false); }
  };
  const updateRequest = async (request, status) => {
    setBusy(true); setActionError('');
    try { await api.patch(`/ingredients/requisitions/${request.id}/status`, { status }); setMessage(status === 'Dispatched' ? 'Kitchen request dispatched. Total bakery stock remains unchanged.' : 'Request rejected.'); await refresh(); }
    catch (error) { setActionError(error.message); } finally { setBusy(false); }
  };
  return <div className="owner-workspace ow-stock">
    <PageHeader eyebrow="Stock & suppliers" title="Stock & suppliers" description="Keep an eye on ingredients, record received goods, and handle kitchen requests."><RefreshButton loading={loading} onClick={refresh} />{view === 'suppliers' ? <button className="ow-button ow-button-primary" onClick={() => { setActionError(''); setVendorForm({ name: '', contact_name: '', phone: '', email: '', lead_time_days: 1 }); setNewVendorDialog(true); }}><Plus size={15} />Add supplier</button> : <button className="ow-button ow-button-primary" onClick={() => openReceipt()}><Plus size={15} />Record goods receipt</button>}</PageHeader>
    <Notice error>{error?.message || (!receipt && !policy && !newVendorDialog && actionError)}</Notice><Notice>{message}</Notice>
    <MetricStrip items={[
      { icon: Package, label: 'Ingredients', value: data ? ingredients.length : '—', note: `${categories.length} pantry categories` },
      { icon: AlertTriangle, label: 'Below minimum', value: data ? low.length : '—', note: 'Based on available stock' },
      { icon: LockKeyhole, label: 'With reservations', value: data ? ingredients.filter(item => Number(item.reserved_stock) > 0).length : '—', note: 'Ingredients held for production' },
      { icon: ClipboardList, label: 'Kitchen requests', value: data ? requests.filter(item => item.status === 'Pending').length : '—', note: 'Awaiting your response' },
    ]} />
    <div className="ow-toolbar"><div className="ow-tabs" role="tablist" aria-label="Stock views">{[['stock', 'Ingredients', ingredients.length], ['movements', 'Stock Movements', movements.length], ['suppliers', 'Suppliers', vendors.length], ['requests', 'Kitchen requests', requests.filter(item => item.status === 'Pending').length]].map(([key, label, count]) => <button role="tab" aria-selected={view === key} key={key} onClick={() => { setView(key); setSearch(''); }}>{label}<span>{count}</span></button>)}</div><label className="ow-search"><Search size={15} /><input aria-label="Search stock and suppliers" value={search} onChange={event => setSearch(event.target.value)} placeholder={view === 'stock' ? 'Search ingredient or supplier…' : view === 'movements' ? 'Search ingredient or activity…' : view === 'suppliers' ? 'Search supplier…' : 'Search kitchen requests…'} /></label></div>
    {view === 'stock' && <>
      <div className="ow-actions"><select className="ow-select" aria-label="Ingredient category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select><button className={`ow-button ${shortageOnly ? 'ow-button-primary' : 'ow-button-light'}`} aria-pressed={shortageOnly} onClick={() => setShortageOnly(!shortageOnly)}><SlidersHorizontal size={14} />Needs replenishing{low.length > 0 ? ` (${low.length})` : ''}</button><span className="ow-muted ow-small" style={{ marginLeft: 'auto' }}>{filtered.length} ingredients</span></div>
      <section className="ow-panel">{filtered.length ? <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>Ingredient</th><th className="ow-numeric">Available Stock</th><th className="ow-numeric">Reserved</th><th className="ow-numeric">Minimum Threshold</th><th className="ow-numeric">Purchase Cost</th><th>Inventory Status</th><th /></tr></thead><tbody>{filtered.map(item => {
        const isYellow = item.stock_level === 'yellow' || item.stock_status === 'Low Stock';
        const isRed = item.stock_level === 'red' || item.stock_status === 'Out of Stock';
        return <tr key={item.id}>
          <td><strong>{item.name}</strong><small>{item.category}{item.supplier_name ? ` · ${item.supplier_name}` : ''}</small></td>
          <td className="ow-numeric">
            <strong>{formatUnitsDisplay(item.available_stock, item.unit).primary}</strong>
            {formatUnitsDisplay(item.available_stock, item.unit).secondary && <small className="ow-muted">{formatUnitsDisplay(item.available_stock, item.unit).secondary}</small>}
            <small style={{ color: 'var(--ow-muted)', marginTop: '2px' }}>Physical: {quantity(item.current_stock)} {item.unit}</small>
          </td>
          <td className="ow-numeric">{quantity(item.reserved_stock)} {item.unit}</td>
          <td className="ow-numeric">
            <strong>{formatUnitsDisplay(item.minimum_stock, item.unit).primary}</strong>
            {formatUnitsDisplay(item.minimum_stock, item.unit).secondary && <small className="ow-muted">{formatUnitsDisplay(item.minimum_stock, item.unit).secondary}</small>}
          </td>
          <td className="ow-numeric">{money(item.cost_per_unit)}<small>per {item.unit}</small></td>
          <td>
            <StatusBadge value={isRed ? 'Out of Stock' : isYellow ? 'Low Stock' : 'Optimal'} tone={isRed ? 'danger' : isYellow ? 'amber' : 'success'} />
            {isYellow && <small style={{ display: 'block', color: '#9a642a', fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>Low stock alert</small>}
            {isRed && <small style={{ display: 'block', color: '#a35146', fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>Products disabled</small>}
            {!isYellow && !isRed && <small style={{ display: 'block', color: '#226344', fontSize: '11px', marginTop: '2px' }}>Sufficient stock</small>}
          </td>
          <td>
            <div className="ow-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="ow-button" onClick={() => openReceipt(item)}>Restock<Plus size={13} /></button>
              <button className="ow-icon-button" aria-label={`Set threshold for ${item.name}`} title="Configure low-stock threshold" onClick={() => openThresholdModal(item)}>
                <SlidersHorizontal size={14} />
              </button>
            </div>
          </td>
        </tr>;
      })}</tbody></table></div> : <EmptyState title={loading && !data ? 'Loading pantry stock…' : 'No ingredients match'}>Try a different search or category.</EmptyState>}</section>
      <div className="ow-footer-note"><span>Available = physical stock − production reservations</span><span>Crossing minimum threshold alerts the owner to replenish; orders continue unless stock is completely depleted.</span></div>
    </>}
    {view === 'suppliers' && <section className="ow-panel">{vendors.filter(vendor => `${vendor.name} ${vendor.email || ''}`.toLowerCase().includes(search.toLowerCase())).length ? <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>Supplier</th><th>Contact</th><th>Recorded purchases</th><th /></tr></thead><tbody>{vendors.filter(vendor => `${vendor.name} ${vendor.email || ''}`.toLowerCase().includes(search.toLowerCase())).map(vendor => {
      const purchases = (data?.comparisons || []).flatMap(item => item.quotes.filter(quote => Number(quote.supplier_id) === Number(vendor.id)).map(quote => ({ ...quote, material: item.material_name })));
      return <tr key={vendor.id}><td><strong>{vendor.name}</strong><small>{vendor.contact_person || vendor.contact_name || 'Contact person not recorded'}</small></td><td>{vendor.phone ? <a className="ow-text-link" href={`tel:${vendor.phone}`}>{vendor.phone}</a> : '—'}<small>{vendor.email}</small></td><td>{purchases.length ? purchases.slice(0, 3).map(item => <small key={item.material}>{item.material} · {money(item.price_per_unit)} / {item.unit}</small>) : <span className="ow-muted">No purchase prices recorded</span>}</td><td>{vendor.email && <a className="ow-icon-button" href={`mailto:${vendor.email}`} aria-label={`Email ${vendor.name}`}><ArrowUpRight size={15} /></a>}</td></tr>;
    })}</tbody></table></div> : <EmptyState title={loading && !data ? 'Loading suppliers…' : 'No suppliers match'} action={<button className="ow-button ow-button-primary" style={{ marginTop: '12px' }} onClick={() => { setActionError(''); setVendorForm({ name: '', contact_name: '', phone: '', email: '', lead_time_days: 1 }); setNewVendorDialog(true); }}><Plus size={14} />Add first supplier</button>}>Supplier details come from saved procurement records.</EmptyState>}<div className="ow-section-header"><p className="ow-muted ow-small" style={{ margin: 0 }}>Prices shown are the last recorded purchases, rather than live supplier quotes. Use a goods receipt after a delivery arrives.</p></div></section>}
    
    {view === 'movements' && (
      <section className="ow-panel">
        <div className="ow-section-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Ingredient Consumption & Stock Movements</h3>
            <p className="ow-muted ow-small" style={{ margin: '4px 0 0' }}>
              Real-time audit log of all ingredient deductions from kitchen production and incoming goods receipts.
            </p>
          </div>
        </div>
        {movements.filter(m => `${m.ingredient_name || ''} ${m.movement_type || ''} ${m.reference_id || ''} ${m.reference_type || ''}`.toLowerCase().includes(search.toLowerCase())).length ? (
          <div className="ow-table-wrap">
            <table className="ow-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Ingredient</th>
                  <th>Activity Type</th>
                  <th className="ow-numeric">Quantity Change</th>
                  <th>Reference</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements
                  .filter(m => `${m.ingredient_name || ''} ${m.movement_type || ''} ${m.reference_id || ''} ${m.reference_type || ''}`.toLowerCase().includes(search.toLowerCase()))
                  .map(m => {
                    const isDeduction = m.movement_type === 'CONSUMPTION' || m.movement_type === 'DEDUCTION' || m.movement_type === 'WASTAGE' || Number(m.quantity_change) < 0;
                    return (
                      <tr key={m.id}>
                        <td>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>
                            {dateLabel(m.created_at)}
                          </span>
                          <small className="ow-muted" style={{ display: 'block' }}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </small>
                        </td>
                        <td>
                          <strong>{m.ingredient_name || `Ingredient #${m.raw_material_id}`}</strong>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isDeduction ? '#FEF2F2' : '#F0FDF4',
                            color: isDeduction ? '#DC2626' : '#166534',
                            border: `1px solid ${isDeduction ? '#FCA5A5' : '#86EFAC'}`
                          }}>
                            {m.movement_type || (isDeduction ? 'CONSUMPTION' : 'RESTOCK')}
                          </span>
                        </td>
                        <td className="ow-numeric">
                          <strong style={{ color: isDeduction ? '#DC2626' : '#166534', fontSize: '14px' }}>
                            {isDeduction ? '-' : '+'}{Math.abs(Number(m.quantity_change || m.quantity || 0)).toLocaleString(undefined, { maximumFractionDigits: 3 })} {m.ingredient_unit || m.unit || ''}
                          </strong>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#FAF6F0', padding: '2px 6px', borderRadius: '4px', border: '1px solid #EFE6DC' }}>
                            {m.reference_type ? `${m.reference_type.toUpperCase()} #${m.reference_id}` : (m.reference_id ? `#${m.reference_id}` : '—')}
                          </span>
                        </td>
                        <td>
                          <small style={{ color: 'var(--ow-muted)' }}>
                            {m.notes || (isDeduction ? 'Production ingredient consumption' : 'Inventory received')}
                          </small>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={loading && !data ? 'Loading movement history…' : 'No movements found'}>
            Ingredient deductions and goods receipts will appear here automatically.
          </EmptyState>
        )}
      </section>
    )}

    {view === 'requests' && <><div className="ow-actions"><select className="ow-select" aria-label="Kitchen request status" value={requestView} onChange={event => setRequestView(event.target.value)}><option value="Pending">Awaiting response</option><option value="all">All requests</option></select></div><section className="ow-panel">{requests.filter(item => (requestView === 'all' || item.status === requestView) && `${item.ingredient_name} ${item.baker_name}`.toLowerCase().includes(search.toLowerCase())).length ? <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>Ingredient / request</th><th>Requested by</th><th className="ow-numeric">Quantity</th><th>Date</th><th>Status</th><th /></tr></thead><tbody>{requests.filter(item => (requestView === 'all' || item.status === requestView) && `${item.ingredient_name} ${item.baker_name}`.toLowerCase().includes(search.toLowerCase())).map(item => <tr key={item.id}><td><strong>{item.ingredient_name}</strong><small>{item.notes || `Request #${item.id}`}</small></td><td>{item.baker_name || 'Kitchen team'}</td><td className="ow-numeric">{quantity(item.requested_quantity ?? item.quantity)} {item.unit}</td><td>{dateLabel(item.request_date || item.created_at)}</td><td><StatusBadge value={item.status} /></td><td>{item.status === 'Pending' && <div className="ow-actions"><button className="ow-button ow-button-primary" disabled={busy} onClick={() => updateRequest(item, 'Dispatched')}>Dispatch</button><button className="ow-button ow-button-light" disabled={busy} onClick={() => updateRequest(item, 'Rejected')}>Reject</button></div>}</td></tr>)}</tbody></table></div> : <EmptyState title="No requests awaiting action">Your kitchen team's ingredient requests will appear here.</EmptyState>}</section><p className="ow-footer-note">Dispatch is an internal transfer to the kitchen. Ingredient consumption is recorded when production starts.</p></>}
    {receipt && <Dialog title="Record goods received" description="Add delivered inventory in kilograms (kg), litres (L), grams (g), or pieces with automatic conversion." onClose={() => setReceipt(null)} footer={<><button className="ow-button" onClick={() => setReceipt(null)}>Cancel</button><button className="ow-button ow-button-primary" disabled={busy} type="submit" form="goods-receipt">{busy ? 'Recording…' : 'Record receipt'}</button></>}><form id="goods-receipt" className="ow-form" onSubmit={saveReceipt}><Notice error>{actionError}</Notice><label className="ow-field">Ingredient<select required value={receipt.id} onChange={event => { const item = ingredients.find(row => String(row.id) === event.target.value); const defUnit = item ? (['g', 'kg'].includes(item.unit?.toLowerCase()) ? 'kg' : ['ml', 'l'].includes(item.unit?.toLowerCase()) ? 'L' : item.unit) : 'kg'; setReceipt({ ...receipt, id: event.target.value, inputUnit: defUnit, cost: String(item?.cost_per_unit ?? ''), supplier: item?.primary_supplier_id ? String(item.primary_supplier_id) : '' }); }}><option value="">Select ingredient</option>{ingredients.map(item => <option key={item.id} value={String(item.id)}>{item.name} ({item.unit})</option>)}</select></label><div className="ow-form-grid"><label className="ow-field">Quantity received<div style={{ display: 'flex', gap: '8px' }}><input type="number" required min="0.000001" step="any" value={receipt.amount} onChange={event => setReceipt({ ...receipt, amount: event.target.value })} placeholder="0" style={{ flex: 1 }} /><select value={receipt.inputUnit || material?.unit || 'kg'} onChange={event => setReceipt({ ...receipt, inputUnit: event.target.value })} style={{ width: '85px', borderRadius: '8px', border: '1px solid var(--border-color, #e8dfd8)', background: '#faf6ef', fontWeight: 600 }}>{['kg', 'g'].includes(material?.unit?.toLowerCase()) && (<><option value="kg">kg</option><option value="g">g</option></>)}{['l', 'ml'].includes(material?.unit?.toLowerCase()) && (<><option value="L">L</option><option value="ml">mL</option></>)}{!['kg', 'g', 'l', 'ml'].includes(material?.unit?.toLowerCase()) && (<option value={material?.unit || 'pcs'}>{material?.unit || 'pcs'}</option>)}</select></div>{receipt.amount && material && receipt.inputUnit && receipt.inputUnit.toLowerCase() !== material.unit.toLowerCase() && (<small style={{ color: 'var(--amber-700, #9a642a)', fontWeight: 600, display: 'block', marginTop: '4px' }}>Auto-converts: {receipt.inputUnit.toLowerCase() === 'kg' && material.unit.toLowerCase() === 'g' ? `${(Number(receipt.amount) * 1000).toLocaleString()} g` : receipt.inputUnit.toLowerCase() === 'g' && material.unit.toLowerCase() === 'kg' ? `${(Number(receipt.amount) / 1000).toFixed(3)} kg` : receipt.inputUnit.toLowerCase() === 'l' && material.unit.toLowerCase() === 'ml' ? `${(Number(receipt.amount) * 1000).toLocaleString()} mL` : receipt.inputUnit.toLowerCase() === 'ml' && material.unit.toLowerCase() === 'l' ? `${(Number(receipt.amount) / 1000).toFixed(3)} L` : `${receipt.amount} ${material.unit}`} (internal unit)</small>)}</label><label className="ow-field">Purchase cost per {receipt.inputUnit || material?.unit || 'unit'} (₹)<input required type="number" min="0" step="any" value={receipt.cost} onChange={event => setReceipt({ ...receipt, cost: event.target.value })} /></label></div><label className="ow-field">Supplier<select value={receipt.supplier} onChange={event => setReceipt({ ...receipt, supplier: event.target.value })}><option value="">Use existing supplier / unspecified</option>{vendors.map(vendor => <option key={vendor.id} value={String(vendor.id)}>{vendor.name}</option>)}<option value="__new__">+ Add new supplier…</option></select></label>{receipt.supplier === '__new__' && <div style={{ padding: '12px 14px', background: 'var(--surface-subtle, #f9f6f0)', borderRadius: '8px', border: '1px solid var(--border-color, #e8dfd8)', marginBottom: '12px' }}><label className="ow-field" style={{ marginBottom: '8px' }}>New supplier name *<input required autoFocus placeholder="e.g. Bandra Dairy & Farm" value={receipt.newSupplierName || ''} onChange={event => setReceipt({ ...receipt, newSupplierName: event.target.value })} /></label><div className="ow-form-grid"><label className="ow-field">Contact person (optional)<input placeholder="e.g. Ramesh Shah" value={receipt.newSupplierContact || ''} onChange={event => setReceipt({ ...receipt, newSupplierContact: event.target.value })} /></label><label className="ow-field">Phone (optional)<input placeholder="e.g. +91 98200 99999" value={receipt.newSupplierPhone || ''} onChange={event => setReceipt({ ...receipt, newSupplierPhone: event.target.value })} /></label></div></div>}<div className="ow-form-grid"><label className="ow-field">Lot reference<input value={receipt.lot} placeholder="Optional; generated if empty" onChange={event => setReceipt({ ...receipt, lot: event.target.value })} /></label><label className="ow-field">Expiry date<input type="date" value={receipt.expiry} onChange={event => setReceipt({ ...receipt, expiry: event.target.value })} /></label></div>{material && <p className="ow-muted ow-small">Currently {quantity(material.current_stock)} {material.unit} in stock; {quantity(material.reserved_stock)} {material.unit} reserved. This receipt updates the purchase cost used by future recipe estimates.</p>}</form></Dialog>}
    {policy && (() => {
      const u = (policy.item.unit || '').toLowerCase();
      const isWeight = ['kg', 'g'].includes(u);
      const isVolume = ['l', 'ml'].includes(u);
      const availFmt = formatUnitsDisplay(policy.item.available_stock, policy.item.unit);
      const currentThreshFmt = formatUnitsDisplay(policy.item.minimum_stock ?? policy.item.min_reorder_level, policy.item.unit);

      return (
        <Dialog
          title="Ingredient Stock Threshold Settings"
          description={`${policy.item.name} (${policy.item.category || 'Pantry ingredient'})`}
          onClose={() => setPolicy(null)}
          footer={
            <>
              <button className="ow-button" type="button" onClick={() => setPolicy(null)}>Cancel</button>
              <button className="ow-button ow-button-primary" disabled={busy} form="stock-policy" type="submit">
                {busy ? 'Saving…' : 'Save threshold'}
              </button>
            </>
          }
        >
          <form id="stock-policy" className="ow-form" onSubmit={savePolicy}>
            <Notice error>{actionError}</Notice>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: 'var(--ow-wash, #f5f0e9)', padding: '14px', borderRadius: '8px', border: '1px solid var(--ow-line, #e8e0d7)' }}>
              <div>
                <small style={{ color: 'var(--ow-muted)', fontSize: '11px', display: 'block' }}>Available Stock</small>
                <strong style={{ fontSize: '14px', color: 'var(--ow-ink)' }}>{availFmt.primary}</strong>
                {availFmt.secondary && <small style={{ display: 'block', color: 'var(--ow-muted)', fontSize: '11px' }}>{availFmt.secondary}</small>}
              </div>
              <div>
                <small style={{ color: 'var(--ow-muted)', fontSize: '11px', display: 'block' }}>Physical Stock</small>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{quantity(policy.item.current_stock)} {policy.item.unit}</span>
              </div>
              <div>
                <small style={{ color: 'var(--ow-muted)', fontSize: '11px', display: 'block' }}>Current Threshold</small>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ow-accent)' }}>{currentThreshFmt.primary}</span>
              </div>
            </div>

            <label className="ow-field">
              Minimum stock threshold
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={policy.minimum}
                  onChange={event => setPolicy({ ...policy, minimum: event.target.value })}
                  placeholder="Enter low-stock threshold"
                  style={{ flex: 1 }}
                />
                <select
                  value={policy.inputUnit}
                  onChange={event => handleThresholdUnitChange(event.target.value)}
                  style={{ width: '90px', borderRadius: '6px', border: '1px solid var(--ow-line)', background: 'var(--ow-wash)', fontWeight: 600 }}
                >
                  {isWeight && (
                    <>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </>
                  )}
                  {isVolume && (
                    <>
                      <option value="mL">mL</option>
                      <option value="L">L</option>
                    </>
                  )}
                  {!isWeight && !isVolume && (
                    <option value={policy.item.unit || 'pcs'}>{policy.item.unit || 'pcs'}</option>
                  )}
                </select>
              </div>
              <small className="ow-muted">
                {isWeight && policy.inputUnit === 'g' && policy.item.unit?.toLowerCase() === 'kg' && policy.minimum && (
                  <span>Stores internally as {(Number(policy.minimum) / 1000).toFixed(3)} kg</span>
                )}
                {isWeight && policy.inputUnit === 'kg' && policy.item.unit?.toLowerCase() === 'g' && policy.minimum && (
                  <span>Stores internally as {Math.round(Number(policy.minimum) * 1000).toLocaleString()} g</span>
                )}
                {isVolume && policy.inputUnit === 'mL' && policy.item.unit?.toLowerCase() === 'l' && policy.minimum && (
                  <span>Stores internally as {(Number(policy.minimum) / 1000).toFixed(3)} L</span>
                )}
                {isVolume && policy.inputUnit === 'L' && policy.item.unit?.toLowerCase() === 'ml' && policy.minimum && (
                  <span>Stores internally as {Math.round(Number(policy.minimum) * 1000).toLocaleString()} mL</span>
                )}
              </small>
            </label>

            <div style={{ background: '#faf6ef', border: '1px solid #ebdccb', borderRadius: '6px', padding: '12px 14px', fontSize: '12px', color: '#6d4b2d' }}>
              <strong>Inventory replenishment notice:</strong>
              <p style={{ margin: '4px 0 0', lineHeight: 1.45 }}>
                When available stock falls to or below this threshold, a low-stock alert is shown to notify you to reorder ingredients. Orders continue to be accepted as long as sufficient stock exists to fulfill each item.
              </p>
            </div>
          </form>
        </Dialog>
      );
    })()}
    {newVendorDialog && <Dialog title="Add new supplier" description="Register a new supplier for ingredient procurement." onClose={() => setNewVendorDialog(false)} footer={<><button className="ow-button" onClick={() => setNewVendorDialog(false)}>Cancel</button><button className="ow-button ow-button-primary" disabled={busy} type="submit" form="new-supplier-form">{busy ? 'Saving…' : 'Add supplier'}</button></>}><form id="new-supplier-form" className="ow-form" onSubmit={saveNewVendor}><Notice error>{actionError}</Notice><label className="ow-field">Supplier name *<input required autoFocus placeholder="e.g. Bandra Organic Mills" value={vendorForm.name} onChange={event => setVendorForm({ ...vendorForm, name: event.target.value })} /></label><div className="ow-form-grid"><label className="ow-field">Contact person<input placeholder="e.g. Sunil Deshmukh" value={vendorForm.contact_name} onChange={event => setVendorForm({ ...vendorForm, contact_name: event.target.value })} /></label><label className="ow-field">Phone<input placeholder="e.g. +91 98200 11223" value={vendorForm.phone} onChange={event => setVendorForm({ ...vendorForm, phone: event.target.value })} /></label></div><div className="ow-form-grid"><label className="ow-field">Email<input type="email" placeholder="orders@supplier.in" value={vendorForm.email} onChange={event => setVendorForm({ ...vendorForm, email: event.target.value })} /></label><label className="ow-field">Lead time (days)<input type="number" min="0" step="1" value={vendorForm.lead_time_days} onChange={event => setVendorForm({ ...vendorForm, lead_time_days: event.target.value })} /></label></div></form></Dialog>}
  </div>;
}
