import React, { useState, useEffect } from 'react';
import ownerService from '../../services/ownerService';
import staffService from '../../services/staffService';
import api from '../../services/api';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Flame,
  ShieldCheck,
  PackageCheck,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Link as LinkIcon,
  X
} from 'lucide-react';

const OwnerBatchesPage = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState('');

  // Allocate Order Modal State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocatingBatch, setAllocatingBatch] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [allocForm, setAllocForm] = useState({
    order_id: '',
    quantity: 1,
    weight_grams: ''
  });
  const [submittingAlloc, setSubmittingAlloc] = useState(false);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await ownerService.getBatches();
      setBatches(res.data || res || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleUpdateStatus = async (batchId, newStatus) => {
    try {
      await staffService.updateBatchStatus(batchId, {
        status: newStatus,
        notes: `Status updated by Owner to ${newStatus}`
      });
      setNotification(`Batch #${batchId} status updated to ${newStatus}!`);
      setTimeout(() => setNotification(''), 4000);
      await fetchBatches();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update batch status');
    }
  };

  const openAllocateModal = async (batch) => {
    setAllocatingBatch(batch);
    setAllocForm({
      order_id: '',
      quantity: 1,
      weight_grams: ''
    });
    setShowAllocateModal(true);
    try {
      const ordersRes = await ownerService.getOrders();
      const list = Array.isArray(ordersRes?.data) ? ordersRes.data : (Array.isArray(ordersRes) ? ordersRes : []);
      // Filter orders that are active
      setAllOrders(list.filter(o => !['Delivered', 'Cancelled'].includes(o.order_status)));
    } catch (err) {
      console.warn('Could not load orders for allocation:', err);
    }
  };

  const handleExecuteAllocation = async (e) => {
    e.preventDefault();
    if (!allocatingBatch || !allocForm.order_id) {
      alert('Please select an order to allocate.');
      return;
    }
    setSubmittingAlloc(true);
    try {
      await api.post(`/batches/${allocatingBatch.id}/allocate`, {
        order_id: Number(allocForm.order_id),
        quantity: Number(allocForm.quantity),
        weight_grams: allocForm.weight_grams ? Number(allocForm.weight_grams) : null
      });

      setShowAllocateModal(false);
      setNotification(`Order #${allocForm.order_id} allocated to Batch #${allocatingBatch.batch_no || allocatingBatch.id}!`);
      setTimeout(() => setNotification(''), 4500);
      await fetchBatches();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to allocate order to batch');
    } finally {
      setSubmittingAlloc(false);
    }
  };

  const filtered = batches.filter(b => {
    let matchesStatus = false;
    const bStatus = (b.status || '').toLowerCase();
    if (statusFilter === 'ALL') {
      matchesStatus = true;
    } else if (statusFilter === 'Packaged') {
      matchesStatus = ['packaged', 'packaging', 'product packed', 'product completed & packed'].includes(bStatus);
    } else if (statusFilter === 'In Production') {
      matchesStatus = ['in production', 'baking', 'preparation', 'proofing', 'cooling', 'product completed'].includes(bStatus);
    } else {
      matchesStatus = bStatus === statusFilter.toLowerCase();
    }

    const matchesSearch = !search ||
      (b.batch_no && b.batch_no.toLowerCase().includes(search.toLowerCase())) ||
      (b.product_name && b.product_name.toLowerCase().includes(search.toLowerCase())) ||
      (b.baker_name && b.baker_name.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (rawStatus) => {
    let bg = '#E0F2FE';
    let text = '#0369A1';
    let label = rawStatus;
    if (rawStatus === 'Planned') { bg = '#F3F4F6'; text = '#4B5563'; }
    if (rawStatus === 'Accepted') { bg = '#EDE9FE'; text = '#5B21B6'; }
    if (['In Production', 'Baking', 'Product Completed'].includes(rawStatus)) { bg = '#FEF3C7'; text = '#92400E'; }
    if (rawStatus === 'Quality Check') { bg = '#F3E8FF'; text = '#6B21A8'; }
    if (['Packaged', 'Packaging', 'Product Packed', 'Product Completed & Packed'].includes(rawStatus)) {
      bg = '#DCFCE7';
      text = '#15803D';
      label = 'Product Completed & Packed';
    }
    if (rawStatus === 'Completed') { bg = '#DCFCE7'; text = '#15803D'; }

    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: bg,
        color: text
      }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '12px 18px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #E7E5E4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563EB'
            }}>
              <Layers size={20} />
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              Live Production Batches
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#78716C', margin: '6px 0 0 44px' }}>
            Monitor artisanal bake schedules, floor progress, quality verification, and multi-customer order allocations.
          </p>
        </div>

        <button
          onClick={fetchBatches}
          disabled={loading}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #D6D3D1',
            backgroundColor: '#FAFAF9',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#1C1917'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Floor</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #E7E5E4',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Batches' },
            { id: 'Planned', label: 'Planned' },
            { id: 'In Production', label: 'In Production' },
            { id: 'Packaged', label: 'Packaged' },
            { id: 'Completed', label: 'Completed' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: statusFilter === f.id ? '2px solid #C25E00' : '1px solid #E7E5E4',
                backgroundColor: statusFilter === f.id ? '#FFF7ED' : '#FAFAF9',
                color: statusFilter === f.id ? '#C25E00' : '#44403C'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#A8A29E' }} />
          <input
            type="text"
            placeholder="Search batch code, product, baker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px 8px 30px',
              borderRadius: '8px',
              border: '1px solid #D6D3D1',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Batches Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E7E5E4', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#78716C' }}>
            Loading live bakery floor batches...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#78716C' }}>
            No batches found in this category.
          </div>
        ) : (
          <div className="ow-table-wrap">
            <table className="ow-table ow-responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAF9F6', borderBottom: '1px solid #E7E5E4', textAlign: 'left', color: '#78716C' }}>
                  <th style={{ padding: '12px 16px' }}>Batch Code</th>
                  <th style={{ padding: '12px 16px' }}>Product</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Baker</th>
                  <th style={{ padding: '12px 16px' }}>Scheduled Start</th>
                  <th style={{ padding: '12px 16px' }}>Target vs Baked</th>
                  <th style={{ padding: '12px 16px' }}>Allocations / Customers</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const hasLinkedOrders = b.linked_orders && b.linked_orders.length > 0;
                  const hasSourceOrders = b.source_orders && b.source_orders.length > 0;
                  const isPlannedBuffer = b.is_planned === 1 || (!hasLinkedOrders && !hasSourceOrders);

                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #F5F5F4' }}>
                      <td data-label="Batch Code" style={{ padding: '14px 16px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px', backgroundColor: '#1C1917', color: '#FDE68A', padding: '3px 8px', borderRadius: '4px' }}>
                          {b.batch_no || b.batch_code}
                        </span>
                      </td>
                      <td data-label="Product" style={{ padding: '14px 16px' }}>
                        <strong style={{ color: '#1C1917' }}>{b.product_name}</strong>
                      </td>
                      <td data-label="Assigned Baker" style={{ padding: '14px 16px', color: '#44403C' }}>
                        {b.baker_name || 'Rajesh Kumar (Baker)'}
                      </td>
                      <td data-label="Scheduled Start" style={{ padding: '14px 16px', color: '#78716C', fontSize: '12px' }}>
                        {b.scheduled_start || '06:00 AM'}
                      </td>
                      <td data-label="Target vs Baked" style={{ padding: '14px 16px' }}>
                        <strong style={{ color: '#1C1917' }}>{b.completed_quantity || 0}</strong> / {b.planned_quantity} pcs
                        {b.planned_weight && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#B45309', fontWeight: 600 }}>
                            Target Weight: {b.planned_weight} {b.planned_weight_unit || 'kg'}
                          </span>
                        )}
                        {b.actual_finished_weight_g && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#15803D', fontWeight: 600 }}>
                            Finished: {b.actual_finished_weight_g >= 1000 ? `${(b.actual_finished_weight_g / 1000).toFixed(2)} kg` : `${b.actual_finished_weight_g} g`} (Yield: {b.yield_percentage || 100}%)
                          </span>
                        )}
                        {b.remaining_quantity !== undefined && (
                          <span style={{ display: 'block', fontSize: '11px', color: b.remaining_quantity > 0 ? '#15803D' : '#78716C' }}>
                            Remaining: {b.remaining_quantity} pcs
                          </span>
                        )}
                      </td>
                      <td data-label="Allocations" style={{ padding: '14px 16px', fontSize: '12px' }}>
                        {hasLinkedOrders ? (
                          <div>
                            <span style={{ fontWeight: 700, color: '#1E40AF', backgroundColor: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>
                              {b.customer_name || `${b.linked_orders.length} Customers`}
                            </span>
                            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#78716C', marginTop: '2px' }}>
                              {b.linked_orders.map(o => o.order_number || `#${o.order_id}`).join(', ')}
                            </div>
                          </div>
                        ) : hasSourceOrders ? (
                          <span style={{ fontFamily: 'monospace', color: '#78716C' }}>
                            {Array.isArray(b.source_orders) ? b.source_orders.join(', ') : b.source_orders}
                          </span>
                        ) : (
                          <span style={{ color: '#64748B', fontStyle: 'italic', fontSize: '11px' }}>
                            Showcase Buffer (Internal)
                          </span>
                        )}
                      </td>
                      <td data-label="Status" style={{ padding: '14px 16px' }}>
                        {getStatusBadge(b.status)}
                      </td>
                      <td data-label="Actions" style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            title="Allocate customer order to this batch"
                            onClick={() => openAllocateModal(b)}
                            style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#FAF5FF', color: '#7E22CE', border: '1px solid #E9D5FF', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <LinkIcon size={12} />
                            <span>Allocate</span>
                          </button>

                          {b.status === 'Planned' && (
                            <button
                              onClick={() => handleUpdateStatus(b.id, 'Accepted')}
                              style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#C25E00', color: '#FFFFFF', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Accept
                            </button>
                          )}
                          {b.status === 'Accepted' && (
                            <button
                              onClick={() => handleUpdateStatus(b.id, 'In Production')}
                              style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#D97706', color: '#FFFFFF', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Bake
                            </button>
                          )}
                          {['In Production', 'Baking', 'Product Completed', 'Quality Check'].includes(b.status) && (
                            <button
                              onClick={() => handleUpdateStatus(b.id, 'Product Completed & Packed')}
                              style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#0284C7', color: '#FFFFFF', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Pack
                            </button>
                          )}
                          {['Packaged', 'Packaging', 'Product Packed', 'Product Completed & Packed'].includes(b.status) && (
                            <button
                              onClick={() => handleUpdateStatus(b.id, 'Completed')}
                              style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#16A34A', color: '#FFFFFF', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Dispatch
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ALLOCATE CUSTOMER ORDER TO BATCH */}
      {showAllocateModal && allocatingBatch && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E7E5E4', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LinkIcon size={18} color="#7E22CE" />
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#1C1917' }}>
                  Allocate Order to Batch #{allocatingBatch.batch_no || allocatingBatch.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#78716C' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#78716C' }}>
              Link a customer order to this production batch. Multiple customer orders can be fulfilled by the same production batch.
            </p>

            <form onSubmit={handleExecuteAllocation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Select Customer Order *
                </label>
                <select
                  required
                  value={allocForm.order_id}
                  onChange={(e) => setAllocForm(prev => ({ ...prev, order_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px' }}
                >
                  <option value="">-- Choose active order --</option>
                  {allOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.order_number || `#${o.id}`} — {o.customer_name || 'Guest'} ({o.order_status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Units to Allocate *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={allocForm.quantity}
                    onChange={(e) => setAllocForm(prev => ({ ...prev, quantity: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Weight in Grams (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 500"
                    value={allocForm.weight_grams}
                    onChange={(e) => setAllocForm(prev => ({ ...prev, weight_grams: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D6D3D1', background: '#FAFAF9', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAlloc}
                  style={{ padding: '8px 18px', borderRadius: '8px', backgroundColor: '#7E22CE', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {submittingAlloc ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerBatchesPage;
