import React, { useState } from 'react';
import {
  Package,
  AlertTriangle,
  LockKeyhole,
  ClipboardList,
  Search,
  Plus,
  SlidersHorizontal,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Truck,
  RotateCcw,
  Check,
  ShieldAlert
} from 'lucide-react';
import api from '../../services/api';
import ownerService from '../../services/ownerService';
import staffService from '../../services/staffService';
import usePolling from '../../hooks/usePolling';
import {
  PageHeader,
  RefreshButton,
  MetricStrip,
  StatusBadge,
  Notice,
  EmptyState,
  Dialog,
  money,
  quantity,
  dateLabel,
  listOf,
  unwrap
} from '../../components/owner/OwnerUI';

export default function OwnerStockSuppliersPage() {
  const { data, loading, error, refresh } = usePolling(async () => {
    const [inventory, vendorResponse, comparisons, requests, movementsRes, notificationsRes] = await Promise.all([
      ownerService.getInventory(),
      ownerService.getVendors(),
      ownerService.getVendorComparisons(),
      staffService.getRequisitions(),
      ownerService.getStockMovements().catch(() => []),
      ownerService.getActiveStockNotifications().catch(() => ({ data: [] }))
    ]);
    const vendors = unwrap(vendorResponse);
    return {
      ingredients: listOf(inventory),
      vendors: Array.isArray(vendors) ? vendors : vendors?.vendors || [],
      comparisons: listOf(comparisons),
      requests: listOf(requests),
      movements: listOf(movementsRes),
      notifications: listOf(notificationsRes)
    };
  }, 15000);

  const [view, setView] = useState('stock');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [shortageOnly, setShortageOnly] = useState(false);
  const [requestView, setRequestView] = useState('Pending');

  // Modals & Forms
  const [receipt, setReceipt] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [confirmReceiptDialog, setConfirmReceiptDialog] = useState(null);
  const [replacementDialog, setReplacementDialog] = useState(null);
  const [newVendorDialog, setNewVendorDialog] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', contact_name: '', phone: '', email: '', lead_time_days: 1 });

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  const ingredients = data?.ingredients || [];
  const vendors = data?.vendors || [];
  const requests = data?.requests || [];
  const movements = data?.movements || [];

  // Consistent Low Stock definition across all screens:
  // Low Stock: available <= minimum_stock (and > 0)
  // Out of Stock: available <= 0
  const low = ingredients.filter(item => ['Low Stock', 'Out of Stock'].includes(item.stock_status));
  const categories = [...new Set(ingredients.map(item => item.category).filter(Boolean))];
  const filtered = ingredients.filter(item =>
    (!category || item.category === category) &&
    (!shortageOnly || ['Low Stock', 'Out of Stock'].includes(item.stock_status)) &&
    `${item.name} ${item.sku || ''} ${item.supplier_name || ''}`.toLowerCase().includes(search.toLowerCase())
  );

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
    if (u === 'l' || u === 'litre' || u === 'litres' || u === 'liter') {
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
    event.preventDefault();
    setBusy(true);
    setActionError('');
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
      setReceipt(null);
      setMessage('Goods receipt recorded. Stock and purchase cost are updated permanently in PostgreSQL.');
      await refresh();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  };

  // Step 1: Send Replacement Request
  const openSendReplacement = (item = null) => {
    setActionError('');
    setReplacementDialog({
      raw_material_id: item ? String(item.id) : (ingredients[0] ? String(ingredients[0].id) : ''),
      quantity: item ? String(item.suggested_replenishment > 0 ? item.suggested_replenishment : 50) : '50',
      unit: item?.unit || 'kg',
      urgency: item?.stock_status === 'Out of Stock' ? 'Critical' : 'High',
      notes: item ? `Replacement request for ${item.name}` : ''
    });
  };

  const submitReplacementRequest = async event => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      const selectedItem = ingredients.find(i => String(i.id) === String(replacementDialog.raw_material_id));
      await ownerService.createReplacementRequest({
        raw_material_id: Number(replacementDialog.raw_material_id),
        requested_quantity: Number(replacementDialog.quantity),
        unit: replacementDialog.unit || selectedItem?.unit || 'kg',
        urgency: replacementDialog.urgency,
        notes: replacementDialog.notes || `Replacement request for ${selectedItem?.name || 'ingredient'}`
      });
      setReplacementDialog(null);
      setMessage(`Replacement request for ${selectedItem?.name} submitted successfully! Available inventory remains unchanged until goods are physically received.`);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Confirm Replenishment (Goods Received -> Permanently Increases Stock)
  const openConfirmReceipt = req => {
    setActionError('');
    const ing = ingredients.find(i => Number(i.id) === Number(req.raw_material_id));
    setConfirmReceiptDialog({
      requisition: req,
      ingredient: ing,
      actual_quantity: String(req.requested_quantity || req.quantity || 50),
      unit_price: ing ? String(ing.cost_per_unit || '') : '',
      lot_number: `LOT-REP-${Date.now().toString().slice(-6)}`,
      notes: `Confirmed received for request #${req.id}`
    });
  };

  const submitConfirmReplenishment = async event => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      const reqId = confirmReceiptDialog.requisition.id;
      const actualQty = Number(confirmReceiptDialog.actual_quantity);
      if (isNaN(actualQty) || actualQty <= 0) {
        throw new Error('Enter a valid received quantity');
      }

      const res = await ownerService.confirmReplenishment(reqId, {
        actual_quantity: actualQty,
        unit_price: confirmReceiptDialog.unit_price ? Number(confirmReceiptDialog.unit_price) : undefined,
        lot_number: confirmReceiptDialog.lot_number,
        notes: confirmReceiptDialog.notes
      });

      const ingName = confirmReceiptDialog.ingredient?.name || confirmReceiptDialog.requisition?.ingredient_name;
      const prevStock = res.data?.previous_stock ?? confirmReceiptDialog.ingredient?.available_stock;
      const newStock = res.data?.new_available_stock ?? (Number(prevStock || 0) + actualQty);

      setConfirmReceiptDialog(null);
      setMessage(`Replenishment confirmed! Added ${actualQty} ${confirmReceiptDialog.ingredient?.unit || 'kg'} to ${ingName}. Stock permanently updated from ${Number(prevStock).toFixed(2)} to ${Number(newStock).toFixed(2)} ${confirmReceiptDialog.ingredient?.unit || 'kg'}.`);
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveNewVendor = async event => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      if (!vendorForm.name?.trim()) throw new Error('Supplier name is required');
      await ownerService.createVendor(vendorForm);
      setNewVendorDialog(false);
      setMessage(`Supplier "${vendorForm.name.trim()}" added successfully.`);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
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
    event.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      await api.patch(`/ingredients/${policy.item.id}/policy`, {
        threshold_mode: 'absolute',
        minimum_stock: Number(policy.minimum),
        unit: policy.inputUnit
      });
      setPolicy(null);
      setMessage(`Minimum stock threshold for "${policy.item.name}" updated successfully.`);
      await refresh();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const updateRequest = async (request, status) => {
    setBusy(true);
    setActionError('');
    try {
      await api.patch(`/ingredients/requisitions/${request.id}/status`, { status });
      setMessage(status === 'Rejected' ? 'Request rejected.' : `Request status updated to ${status}.`);
      await refresh();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="owner-workspace ow-stock">
      <PageHeader
        eyebrow="Stock & Replenishment"
        title="Stock & Replenishment"
        description="Monitor real-time ingredient levels, send replacement orders to suppliers, and confirm received goods."
      >
        <RefreshButton loading={loading} onClick={refresh} />
        {view === 'suppliers' ? (
          <button
            className="ow-button ow-button-primary"
            onClick={() => {
              setActionError('');
              setVendorForm({ name: '', contact_name: '', phone: '', email: '', lead_time_days: 1 });
              setNewVendorDialog(true);
            }}
          >
            <Plus size={15} />Add supplier
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="ow-button" onClick={() => openSendReplacement()}>
              <Truck size={14} />Send Replacement Request
            </button>
            <button className="ow-button ow-button-primary" onClick={() => openReceipt()}>
              <Plus size={15} />Record Goods Receipt
            </button>
          </div>
        )}
      </PageHeader>

      <Notice error>{error?.message || (!receipt && !policy && !confirmReceiptDialog && !replacementDialog && !newVendorDialog && actionError)}</Notice>
      <Notice>{message}</Notice>

      {/* Critical / Low Stock Alert Banner (Only shown when items are low or out of stock) */}
      {low.length > 0 && (
        <div style={{
          backgroundColor: '#FFF8E7',
          border: '1px solid #EBDCCB',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(154, 100, 42, 0.08)',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#FEF3C7',
              color: '#9A642A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(154, 100, 42, 0.2)'
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#764919' }}>
                Floor Stock Alert ({low.length} ingredient{low.length > 1 ? 's' : ''} at or below minimum threshold)
              </div>
              <div style={{ fontSize: '12px', color: '#9A642A', marginTop: '2px' }}>
                {low.map(s => `${s.name} (${Number(s.available_stock).toFixed(2)} ${s.unit} left, threshold ${Number(s.minimum_stock).toFixed(2)} ${s.unit})`).join(' • ')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openSendReplacement(low[0])}
            style={{
              padding: '8px 16px',
              backgroundColor: '#AD642E',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={14} />
            <span>Send Replacement Request</span>
          </button>
        </div>
      )}

      <MetricStrip items={[
        { icon: Package, label: 'Ingredients', value: data ? ingredients.length : '—', note: `${categories.length} pantry categories` },
        { icon: AlertTriangle, label: 'Below minimum', value: data ? low.length : '—', note: low.length === 0 ? 'All ingredients optimal' : 'Requires replacement order' },
        { icon: LockKeyhole, label: 'With reservations', value: data ? ingredients.filter(item => Number(item.reserved_stock) > 0).length : '—', note: 'Ingredients held for production' },
        { icon: ClipboardList, label: 'Replenishment requests', value: data ? requests.filter(item => item.status === 'Pending').length : '—', note: 'Awaiting confirmation' },
      ]} />

      <div className="ow-toolbar">
        <div className="ow-tabs" role="tablist" aria-label="Stock views">
          {[
            ['stock', 'Ingredients Inventory', ingredients.length],
            ['requests', 'Replenishment & Requests', requests.filter(item => item.status === 'Pending').length],
            ['movements', 'Stock Movements & Deductions', movements.length],
            ['suppliers', 'Suppliers & Vendors', vendors.length],
          ].map(([key, label, count]) => (
            <button
              role="tab"
              aria-selected={view === key}
              key={key}
              onClick={() => {
                setView(key);
                setSearch('');
              }}
            >
              {label}<span>{count}</span>
            </button>
          ))}
        </div>
        <label className="ow-search">
          <Search size={15} />
          <input
            aria-label="Search stock and suppliers"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={
              view === 'stock' ? 'Search ingredient or supplier…' :
              view === 'movements' ? 'Search ingredient or activity…' :
              view === 'suppliers' ? 'Search supplier…' :
              'Search replenishment requests…'
            }
          />
        </label>
      </div>

      {view === 'stock' && (
        <>
          <div className="ow-actions">
            <select className="ow-select" aria-label="Ingredient category" value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map(item => <option key={item}>{item}</option>)}
            </select>
            <button
              className={`ow-button ${shortageOnly ? 'ow-button-primary' : 'ow-button-light'}`}
              aria-pressed={shortageOnly}
              onClick={() => setShortageOnly(!shortageOnly)}
            >
              <SlidersHorizontal size={14} />Needs replenishing{low.length > 0 ? ` (${low.length})` : ''}
            </button>
            <span className="ow-muted ow-small" style={{ marginLeft: 'auto' }}>{filtered.length} ingredients</span>
          </div>

          <section className="ow-panel">
            {filtered.length ? (
              <div className="ow-table-wrap">
                <table className="ow-table ow-responsive-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th className="ow-numeric">Available Stock</th>
                      <th className="ow-numeric">Reserved</th>
                      <th className="ow-numeric">Minimum Threshold</th>
                      <th className="ow-numeric">Purchase Cost</th>
                      <th>Inventory Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => {
                      const isYellow = item.stock_status === 'Low Stock' || item.stock_level === 'yellow';
                      const isRed = item.stock_status === 'Out of Stock' || item.stock_level === 'red';
                      return (
                        <tr key={item.id}>
                          <td data-label="Ingredient">
                            <strong>{item.name}</strong>
                            <small>{item.category}{item.supplier_name ? ` · ${item.supplier_name}` : ''}</small>
                          </td>
                          <td data-label="Available Stock" className="ow-numeric">
                            <strong>{formatUnitsDisplay(item.available_stock, item.unit).primary}</strong>
                            {formatUnitsDisplay(item.available_stock, item.unit).secondary && (
                              <small className="ow-muted">{formatUnitsDisplay(item.available_stock, item.unit).secondary}</small>
                            )}
                            <small style={{ color: 'var(--ow-muted)', marginTop: '2px' }}>Physical: {quantity(item.current_stock)} {item.unit}</small>
                          </td>
                          <td data-label="Reserved" className="ow-numeric">{quantity(item.reserved_stock)} {item.unit}</td>
                          <td data-label="Min Threshold" className="ow-numeric">
                            <strong>{formatUnitsDisplay(item.minimum_stock, item.unit).primary}</strong>
                            {formatUnitsDisplay(item.minimum_stock, item.unit).secondary && (
                              <small className="ow-muted">{formatUnitsDisplay(item.minimum_stock, item.unit).secondary}</small>
                            )}
                          </td>
                          <td data-label="Purchase Cost" className="ow-numeric">{money(item.cost_per_unit)}<small>per {item.unit}</small></td>
                          <td data-label="Status">
                            <StatusBadge
                              value={isRed ? 'Out of Stock' : isYellow ? 'Low Stock' : 'Optimal'}
                              tone={isRed ? 'danger' : isYellow ? 'amber' : 'success'}
                            />
                            {isYellow && <small style={{ display: 'block', color: '#9a642a', fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>Low stock alert</small>}
                            {isRed && <small style={{ display: 'block', color: '#a35146', fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>Products disabled</small>}
                            {!isYellow && !isRed && <small style={{ display: 'block', color: '#226344', fontSize: '11px', marginTop: '2px' }}>Sufficient stock</small>}
                          </td>
                          <td data-label="Actions">
                            <div className="ow-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                className="ow-button"
                                title="Record goods received and permanently update available stock"
                                onClick={() => openReceipt(item)}
                              >
                                Restock<Plus size={13} />
                              </button>
                              <button
                                className="ow-button ow-button-light"
                                title="Send replacement requisition to supplier"
                                onClick={() => openSendReplacement(item)}
                              >
                                <Truck size={12} />Reorder
                              </button>
                              <button
                                className="ow-icon-button"
                                aria-label={`Set threshold for ${item.name}`}
                                title="Configure low-stock threshold"
                                onClick={() => openThresholdModal(item)}
                              >
                                <SlidersHorizontal size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={loading && !data ? 'Loading pantry stock…' : 'No ingredients match'}>
                Try a different search or category.
              </EmptyState>
            )}
          </section>

          <div className="ow-footer-note">
            <span>Available = physical stock − production reservations</span>
            <span>Single consistent stock status: Optimal (&gt; threshold), Low Stock (≤ threshold), Out of Stock (≤ 0).</span>
          </div>
        </>
      )}

      {/* VIEW: Replenishment & Kitchen Requests */}
      {view === 'requests' && (
        <>
          <div className="ow-actions">
            <select className="ow-select" aria-label="Request status" value={requestView} onChange={event => setRequestView(event.target.value)}>
              <option value="Pending">Awaiting Confirmation (Pending)</option>
              <option value="Received">Confirmed &amp; Received</option>
              <option value="all">All Requests</option>
            </select>
            <button className="ow-button ow-button-primary" style={{ marginLeft: 'auto' }} onClick={() => openSendReplacement()}>
              <Plus size={14} />Send Replacement Request
            </button>
          </div>

          <section className="ow-panel">
            {requests.filter(item => (requestView === 'all' || item.status === requestView) && `${item.ingredient_name || ''} ${item.baker_name || ''}`.toLowerCase().includes(search.toLowerCase())).length ? (
              <div className="ow-table-wrap">
                <table className="ow-table ow-responsive-table">
                  <thead>
                    <tr>
                      <th>Ingredient / Request</th>
                      <th>Requested By</th>
                      <th className="ow-numeric">Requested Qty</th>
                      <th className="ow-numeric">Received Qty</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests
                      .filter(item => (requestView === 'all' || item.status === requestView) && `${item.ingredient_name || ''} ${item.baker_name || ''}`.toLowerCase().includes(search.toLowerCase()))
                      .map(item => {
                        const isPending = item.status === 'Pending' || item.status === 'Requested';
                        const isReceived = item.status === 'Received' || item.status === 'Fulfilled';
                        const ing = ingredients.find(i => Number(i.id) === Number(item.raw_material_id));

                        return (
                          <tr key={item.id}>
                            <td data-label="Request">
                              <strong>{item.ingredient_name || ing?.name || `Ingredient #${item.raw_material_id}`}</strong>
                              <small>{item.notes || `Requisition #${item.id}`}</small>
                              {ing && (
                                <small style={{ color: 'var(--ow-muted)', display: 'block', marginTop: '2px' }}>
                                  Current available: {Number(ing.available_stock).toFixed(2)} {ing.unit}
                                </small>
                              )}
                            </td>
                            <td data-label="Requested By">{item.baker_name || 'Kitchen / Staff'}</td>
                            <td data-label="Requested Qty" className="ow-numeric">
                              <strong>{quantity(item.requested_quantity ?? item.quantity)} {item.unit}</strong>
                            </td>
                            <td data-label="Received Qty" className="ow-numeric">
                              {item.received_quantity ? (
                                <strong style={{ color: '#15803D' }}>+{quantity(item.received_quantity)} {item.unit}</strong>
                              ) : (
                                <span className="ow-muted">—</span>
                              )}
                            </td>
                            <td data-label="Date">
                              {dateLabel(item.request_date || item.created_at)}
                              {item.received_at && (
                                <small style={{ display: 'block', color: '#15803D' }}>
                                  Received {new Date(item.received_at).toLocaleDateString()}
                                </small>
                              )}
                            </td>
                            <td data-label="Status">
                              <StatusBadge
                                value={isReceived ? 'Received' : item.status}
                                tone={isReceived ? 'success' : isPending ? 'amber' : 'neutral'}
                              />
                            </td>
                            <td data-label="Actions">
                              <div className="ow-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                                {isPending ? (
                                  <>
                                    <button
                                      className="ow-button ow-button-primary"
                                      disabled={busy}
                                      title="Confirm actual quantity received from supplier and increase stock"
                                      onClick={() => openConfirmReceipt(item)}
                                      style={{ backgroundColor: '#27AE60', borderColor: '#219653' }}
                                    >
                                      <CheckCircle2 size={13} />
                                      <span>Confirm Received</span>
                                    </button>
                                    <button
                                      className="ow-button ow-button-light"
                                      disabled={busy}
                                      onClick={() => updateRequest(item, 'Rejected')}
                                    >
                                      Reject
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#27AE60', fontWeight: 600 }}>
                                    ✓ Added to stock
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No requests found in this view">
                Replacement requests and kitchen stock requisitions will appear here.
              </EmptyState>
            )}
          </section>

          <div className="ow-footer-note">
            <span>Workflow: Send Replacement (does not increase stock) → Confirm Received (permanently increases PostgreSQL stock and resolves alerts).</span>
          </div>
        </>
      )}

      {/* VIEW: Stock Movements */}
      {view === 'movements' && (
        <section className="ow-panel">
          <div className="ow-section-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Ingredient Consumption &amp; Stock Movements</h3>
              <p className="ow-muted ow-small" style={{ margin: '4px 0 0' }}>
                Permanent audit log of all ingredient deductions from production and incoming replenishment receipts.
              </p>
            </div>
          </div>
          {movements.filter(m => `${m.ingredient_name || ''} ${m.movement_type || ''} ${m.reference_id || ''} ${m.reference_type || ''}`.toLowerCase().includes(search.toLowerCase())).length ? (
            <div className="ow-table-wrap">
              <table className="ow-table ow-responsive-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Ingredient</th>
                    <th>Movement Type</th>
                    <th className="ow-numeric">Quantity Change</th>
                    <th>Reference</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {movements
                    .filter(m => `${m.ingredient_name || ''} ${m.movement_type || ''} ${m.reference_id || ''} ${m.reference_type || ''}`.toLowerCase().includes(search.toLowerCase()))
                    .map(m => {
                      const isDeduction = m.movement_type === 'CONSUMPTION' || m.movement_type === 'deduction' || m.movement_type === 'batch_consumption' || m.movement_type === 'wastage' || Number(m.quantity) < 0;
                      return (
                        <tr key={m.id}>
                          <td data-label="Timestamp">
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>
                              {dateLabel(m.created_at)}
                            </span>
                            <small className="ow-muted" style={{ display: 'block' }}>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </small>
                          </td>
                          <td data-label="Ingredient">
                            <strong>{m.ingredient_name || `Ingredient #${m.raw_material_id}`}</strong>
                          </td>
                          <td data-label="Type">
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: isDeduction ? '#FEF2F2' : '#F0FDF4',
                              color: isDeduction ? '#DC2626' : '#166534',
                              border: `1px solid ${isDeduction ? '#FCA5A5' : '#86EFAC'}`
                            }}>
                              {m.movement_type?.toUpperCase() || (isDeduction ? 'DEDUCTION' : 'REPLENISHMENT')}
                            </span>
                          </td>
                          <td data-label="Quantity Change" className="ow-numeric">
                            <strong style={{ color: isDeduction ? '#DC2626' : '#166534', fontSize: '14px' }}>
                              {isDeduction ? '-' : '+'}{Math.abs(Number(m.quantity || 0)).toLocaleString(undefined, { maximumFractionDigits: 3 })} {m.ingredient_unit || m.unit || ''}
                            </strong>
                          </td>
                          <td data-label="Reference">
                            <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#FAF6F0', padding: '2px 6px', borderRadius: '4px', border: '1px solid #EFE6DC' }}>
                              {m.reference_type ? `${m.reference_type.toUpperCase()} #${m.reference_id}` : (m.reference_id ? `#${m.reference_id}` : '—')}
                            </span>
                          </td>
                          <td data-label="Notes">
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

      {/* VIEW: Suppliers */}
      {view === 'suppliers' && (
        <section className="ow-panel">
          {vendors.filter(vendor => `${vendor.name} ${vendor.email || ''}`.toLowerCase().includes(search.toLowerCase())).length ? (
            <div className="ow-table-wrap">
              <table className="ow-table ow-responsive-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Contact</th>
                    <th>Recorded Purchases</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {vendors
                    .filter(vendor => `${vendor.name} ${vendor.email || ''}`.toLowerCase().includes(search.toLowerCase()))
                    .map(vendor => {
                      const purchases = (data?.comparisons || []).flatMap(item =>
                        item.quotes.filter(quote => Number(quote.supplier_id) === Number(vendor.id)).map(quote => ({ ...quote, material: item.material_name }))
                      );
                      return (
                        <tr key={vendor.id}>
                          <td data-label="Supplier">
                            <strong>{vendor.name}</strong>
                            <small>{vendor.contact_person || vendor.contact_name || 'Contact person not recorded'}</small>
                          </td>
                          <td data-label="Contact">
                            {vendor.phone ? <a className="ow-text-link" href={`tel:${vendor.phone}`}>{vendor.phone}</a> : '—'}
                            <small>{vendor.email}</small>
                          </td>
                          <td data-label="Purchases">
                            {purchases.length ? (
                              purchases.slice(0, 3).map(item => (
                                <small key={item.material}>{item.material} · {money(item.price_per_unit)} / {item.unit}</small>
                              ))
                            ) : (
                              <span className="ow-muted">No purchase prices recorded</span>
                            )}
                          </td>
                          <td data-label="Actions">
                            {vendor.email && (
                              <a className="ow-icon-button" href={`mailto:${vendor.email}`} aria-label={`Email ${vendor.name}`}>
                                <ArrowUpRight size={15} />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={loading && !data ? 'Loading suppliers…' : 'No suppliers match'}
              action={
                <button
                  className="ow-button ow-button-primary"
                  style={{ marginTop: '12px' }}
                  onClick={() => {
                    setActionError('');
                    setVendorForm({ name: '', contact_name: '', phone: '', email: '', lead_time_days: 1 });
                    setNewVendorDialog(true);
                  }}
                >
                  <Plus size={14} />Add first supplier
                </button>
              }
            >
              Supplier details come from saved procurement records.
            </EmptyState>
          )}
        </section>
      )}

      {/* DIALOG 1: Record Goods Receipt (Direct) */}
      {receipt && (
        <Dialog
          title="Record Goods Received"
          description="Add delivered inventory in kilograms (kg), litres (L), grams (g), or pieces with automatic conversion."
          onClose={() => setReceipt(null)}
          footer={
            <>
              <button className="ow-button" onClick={() => setReceipt(null)}>Cancel</button>
              <button className="ow-button ow-button-primary" disabled={busy} type="submit" form="goods-receipt">
                {busy ? 'Recording…' : 'Record Receipt'}
              </button>
            </>
          }
        >
          <form id="goods-receipt" className="ow-form" onSubmit={saveReceipt}>
            <Notice error>{actionError}</Notice>
            <label className="ow-field">
              Ingredient
              <select
                required
                value={receipt.id}
                onChange={event => {
                  const item = ingredients.find(row => String(row.id) === event.target.value);
                  const defUnit = item ? (['g', 'kg'].includes(item.unit?.toLowerCase()) ? 'kg' : ['ml', 'l'].includes(item.unit?.toLowerCase()) ? 'L' : item.unit) : 'kg';
                  setReceipt({
                    ...receipt,
                    id: event.target.value,
                    inputUnit: defUnit,
                    cost: String(item?.cost_per_unit ?? ''),
                    supplier: item?.primary_supplier_id ? String(item.primary_supplier_id) : ''
                  });
                }}
              >
                <option value="">Select ingredient</option>
                {ingredients.map(item => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name} ({item.unit}) — Current: {Number(item.available_stock).toFixed(2)} {item.unit}
                  </option>
                ))}
              </select>
            </label>

            <div className="ow-form-grid">
              <label className="ow-field">
                Quantity received
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    required
                    min="0.000001"
                    step="any"
                    value={receipt.amount}
                    onChange={event => setReceipt({ ...receipt, amount: event.target.value })}
                    placeholder="e.g. 50"
                    style={{ flex: 1 }}
                  />
                  <select
                    value={receipt.inputUnit || material?.unit || 'kg'}
                    onChange={event => setReceipt({ ...receipt, inputUnit: event.target.value })}
                    style={{ width: '85px', borderRadius: '8px', border: '1px solid var(--border-color, #e8dfd8)', background: '#faf6ef', fontWeight: 600 }}
                  >
                    {['kg', 'g'].includes(material?.unit?.toLowerCase()) && (
                      <>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                      </>
                    )}
                    {['l', 'ml', 'litre'].includes(material?.unit?.toLowerCase()) && (
                      <>
                        <option value="L">L</option>
                        <option value="ml">mL</option>
                      </>
                    )}
                    {!['kg', 'g', 'l', 'ml', 'litre'].includes(material?.unit?.toLowerCase()) && (
                      <option value={material?.unit || 'pcs'}>{material?.unit || 'pcs'}</option>
                    )}
                  </select>
                </div>
              </label>

              <label className="ow-field">
                Purchase cost per {receipt.inputUnit || material?.unit || 'unit'} (₹)
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={receipt.cost}
                  onChange={event => setReceipt({ ...receipt, cost: event.target.value })}
                />
              </label>
            </div>

            <label className="ow-field">
              Supplier
              <select
                value={receipt.supplier}
                onChange={event => setReceipt({ ...receipt, supplier: event.target.value })}
              >
                <option value="">Use existing supplier / unspecified</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={String(vendor.id)}>{vendor.name}</option>
                ))}
                <option value="__new__">+ Add new supplier…</option>
              </select>
            </label>

            <div className="ow-form-grid">
              <label className="ow-field">
                Lot reference
                <input
                  value={receipt.lot}
                  placeholder="Optional; generated if empty"
                  onChange={event => setReceipt({ ...receipt, lot: event.target.value })}
                />
              </label>
              <label className="ow-field">
                Expiry date
                <input
                  type="date"
                  value={receipt.expiry}
                  onChange={event => setReceipt({ ...receipt, expiry: event.target.value })}
                />
              </label>
            </div>

            {material && (
              <p className="ow-muted ow-small">
                Currently {Number(material.current_stock).toFixed(2)} {material.unit} in stock. Adding {receipt.amount || 0} {receipt.inputUnit || material.unit} will update physical stock to {((Number(material.current_stock) || 0) + (Number(receipt.amount) || 0)).toFixed(2)} {material.unit}.
              </p>
            )}
          </form>
        </Dialog>
      )}

      {/* DIALOG 2: Step 1 - Send Replacement Request (Does NOT increase stock yet) */}
      {replacementDialog && (
        <Dialog
          title="Step 1 — Send Replacement Request"
          description="Submit a replenishment request to your supplier or storekeeper. Available inventory will NOT increase until you confirm receipt in Step 2."
          onClose={() => setReplacementDialog(null)}
          footer={
            <>
              <button className="ow-button" onClick={() => setReplacementDialog(null)}>Cancel</button>
              <button className="ow-button ow-button-primary" disabled={busy} type="submit" form="send-replacement-form">
                {busy ? 'Sending…' : 'Send Replacement Request'}
              </button>
            </>
          }
        >
          <form id="send-replacement-form" className="ow-form" onSubmit={submitReplacementRequest}>
            {actionError && <Notice error>{actionError}</Notice>}
            <label className="ow-field">
              Ingredient
              <select
                required
                value={replacementDialog.raw_material_id}
                onChange={e => {
                  const sel = ingredients.find(i => String(i.id) === e.target.value);
                  setReplacementDialog({
                    ...replacementDialog,
                    raw_material_id: e.target.value,
                    unit: sel?.unit || 'kg',
                    notes: `Replacement request for ${sel?.name}`
                  });
                }}
              >
                {ingredients.map(ing => (
                  <option key={ing.id} value={String(ing.id)}>
                    {ing.name} ({ing.unit}) — Available: {Number(ing.available_stock).toFixed(2)} {ing.unit} (Min: {Number(ing.minimum_stock).toFixed(2)})
                  </option>
                ))}
              </select>
            </label>

            <div className="ow-form-grid">
              <label className="ow-field">
                Requested Quantity
                <input
                  type="number"
                  required
                  min="0.001"
                  step="any"
                  value={replacementDialog.quantity}
                  onChange={e => setReplacementDialog({ ...replacementDialog, quantity: e.target.value })}
                  placeholder="e.g. 50"
                />
              </label>

              <label className="ow-field">
                Urgency
                <select
                  value={replacementDialog.urgency}
                  onChange={e => setReplacementDialog({ ...replacementDialog, urgency: e.target.value })}
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High (Low Stock)</option>
                  <option value="Critical">Critical (Out of Stock)</option>
                </select>
              </label>
            </div>

            <label className="ow-field">
              Notes / Supplier instructions
              <textarea
                rows={2}
                value={replacementDialog.notes}
                onChange={e => setReplacementDialog({ ...replacementDialog, notes: e.target.value })}
                placeholder="Optional supplier reference or instructions"
              />
            </label>

            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#1E40AF' }}>
              <strong>Notice:</strong> This action records a replacement order. The available stock remains unchanged until goods are physically delivered and confirmed via <em>Confirm Received</em>.
            </div>
          </form>
        </Dialog>
      )}

      {/* DIALOG 3: Step 2 - Confirm Replenishment (Goods Received -> Permanently Increases Stock) */}
      {confirmReceiptDialog && (
        <Dialog
          title="Step 2 — Confirm Goods Received & Replenish Stock"
          description={`Confirm actual quantity received for Request #${confirmReceiptDialog.requisition.id}. This permanently adds inventory to PostgreSQL.`}
          onClose={() => setConfirmReceiptDialog(null)}
          footer={
            <>
              <button className="ow-button" onClick={() => setConfirmReceiptDialog(null)}>Cancel</button>
              <button
                className="ow-button ow-button-primary"
                disabled={busy}
                type="submit"
                form="confirm-replenish-form"
                style={{ backgroundColor: '#27AE60', borderColor: '#219653' }}
              >
                {busy ? 'Confirming…' : 'Confirm & Add to Stock'}
              </button>
            </>
          }
        >
          <form id="confirm-replenish-form" className="ow-form" onSubmit={submitConfirmReplenishment}>
            {actionError && <Notice error>{actionError}</Notice>}

            <div style={{
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div>
                <small className="ow-muted" style={{ display: 'block', fontSize: '11px' }}>Ingredient</small>
                <strong style={{ fontSize: '13px' }}>{confirmReceiptDialog.ingredient?.name || confirmReceiptDialog.requisition?.ingredient_name}</strong>
              </div>
              <div>
                <small className="ow-muted" style={{ display: 'block', fontSize: '11px' }}>Previous Stock</small>
                <strong style={{ fontSize: '14px', color: '#B45309' }}>
                  {Number(confirmReceiptDialog.ingredient?.available_stock || 0).toFixed(2)} {confirmReceiptDialog.ingredient?.unit}
                </strong>
              </div>
              <div>
                <small className="ow-muted" style={{ display: 'block', fontSize: '11px' }}>Requested Qty</small>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {confirmReceiptDialog.requisition?.quantity} {confirmReceiptDialog.requisition?.unit}
                </span>
              </div>
              <div>
                <small className="ow-muted" style={{ display: 'block', fontSize: '11px' }}>Projected Stock</small>
                <strong style={{ fontSize: '14px', color: '#15803D' }}>
                  {(Number(confirmReceiptDialog.ingredient?.available_stock || 0) + Number(confirmReceiptDialog.actual_quantity || 0)).toFixed(2)} {confirmReceiptDialog.ingredient?.unit}
                </strong>
              </div>
            </div>

            <div className="ow-form-grid">
              <label className="ow-field">
                Actual Quantity Received ({confirmReceiptDialog.ingredient?.unit || 'kg'}) *
                <input
                  type="number"
                  required
                  min="0.001"
                  step="any"
                  autoFocus
                  value={confirmReceiptDialog.actual_quantity}
                  onChange={e => setConfirmReceiptDialog({ ...confirmReceiptDialog, actual_quantity: e.target.value })}
                  placeholder="e.g. 50"
                />
              </label>

              <label className="ow-field">
                Unit Purchase Cost (₹)
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={confirmReceiptDialog.unit_price}
                  onChange={e => setConfirmReceiptDialog({ ...confirmReceiptDialog, unit_price: e.target.value })}
                  placeholder={String(confirmReceiptDialog.ingredient?.cost_per_unit || '0')}
                />
              </label>
            </div>

            <div className="ow-form-grid">
              <label className="ow-field">
                Lot / Batch Number
                <input
                  value={confirmReceiptDialog.lot_number}
                  onChange={e => setConfirmReceiptDialog({ ...confirmReceiptDialog, lot_number: e.target.value })}
                  placeholder="e.g. LOT-REP-2026-01"
                />
              </label>

              <label className="ow-field">
                Receipt Notes
                <input
                  value={confirmReceiptDialog.notes}
                  onChange={e => setConfirmReceiptDialog({ ...confirmReceiptDialog, notes: e.target.value })}
                  placeholder="Delivered in good condition"
                />
              </label>
            </div>
          </form>
        </Dialog>
      )}

      {/* DIALOG 4: Threshold Config Modal */}
      {policy && (() => {
        const u = (policy.item.unit || '').toLowerCase();
        const isWeight = ['kg', 'g'].includes(u);
        const isVolume = ['l', 'ml'].includes(u);
        const availFmt = formatUnitsDisplay(policy.item.available_stock, policy.item.unit);
        const currentThreshFmt = formatUnitsDisplay(policy.item.minimum_stock ?? policy.item.min_reorder_level, policy.item.unit);

        return (
          <Dialog
            title={`Configure Low-Stock Threshold: ${policy.item.name}`}
            description="Set the minimum safe inventory level. Crossing this threshold generates an immediate replenishment alert."
            onClose={() => setPolicy(null)}
            footer={
              <>
                <button className="ow-button" onClick={() => setPolicy(null)}>Cancel</button>
                <button className="ow-button ow-button-primary" disabled={busy} type="submit" form="threshold-form">
                  {busy ? 'Saving…' : 'Save Threshold'}
                </button>
              </>
            }
          >
            <form id="threshold-form" className="ow-form" onSubmit={savePolicy}>
              {actionError && <Notice error>{actionError}</Notice>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'var(--ow-subtle)', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
                <div>
                  <small style={{ color: 'var(--ow-muted)', fontSize: '11px', display: 'block' }}>Available Stock</small>
                  <strong style={{ fontSize: '14px', color: 'var(--ow-ink)' }}>{availFmt.primary}</strong>
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
              </label>

              <div style={{ background: '#faf6ef', border: '1px solid #ebdccb', borderRadius: '6px', padding: '12px 14px', fontSize: '12px', color: '#6d4b2d' }}>
                <strong>Consistent notification rules:</strong>
                <p style={{ margin: '4px 0 0', lineHeight: 1.45 }}>
                  • Stock &gt; threshold = OPTIMAL (no alert)<br />
                  • Stock ≤ threshold = LOW STOCK (warning alert)<br />
                  • Stock = 0 = OUT OF STOCK (critical alert)<br />
                  Alerts resolve automatically upon confirmed replenishment.
                </p>
              </div>
            </form>
          </Dialog>
        );
      })()}

      {/* DIALOG 5: New Vendor */}
      {newVendorDialog && (
        <Dialog
          title="Add New Supplier"
          description="Register a new supplier for ingredient procurement."
          onClose={() => setNewVendorDialog(false)}
          footer={
            <>
              <button className="ow-button" onClick={() => setNewVendorDialog(false)}>Cancel</button>
              <button className="ow-button ow-button-primary" disabled={busy} type="submit" form="new-supplier-form">
                {busy ? 'Saving…' : 'Add Supplier'}
              </button>
            </>
          }
        >
          <form id="new-supplier-form" className="ow-form" onSubmit={saveNewVendor}>
            {actionError && <Notice error>{actionError}</Notice>}
            <label className="ow-field">
              Supplier name *
              <input required autoFocus placeholder="e.g. Bandra Organic Mills" value={vendorForm.name} onChange={event => setVendorForm({ ...vendorForm, name: event.target.value })} />
            </label>
            <div className="ow-form-grid">
              <label className="ow-field">
                Contact person
                <input placeholder="e.g. Sunil Deshmukh" value={vendorForm.contact_name} onChange={event => setVendorForm({ ...vendorForm, contact_name: event.target.value })} />
              </label>
              <label className="ow-field">
                Phone
                <input placeholder="e.g. +91 98200 11223" value={vendorForm.phone} onChange={event => setVendorForm({ ...vendorForm, phone: event.target.value })} />
              </label>
            </div>
            <div className="ow-form-grid">
              <label className="ow-field">
                Email
                <input type="email" placeholder="orders@supplier.in" value={vendorForm.email} onChange={event => setVendorForm({ ...vendorForm, email: event.target.value })} />
              </label>
              <label className="ow-field">
                Lead time (days)
                <input type="number" min="0" step="1" value={vendorForm.lead_time_days} onChange={event => setVendorForm({ ...vendorForm, lead_time_days: event.target.value })} />
              </label>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
