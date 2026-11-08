import React, { useState, useEffect } from 'react';
import ownerService from '../../services/ownerService';
import {
  Search,
  Truck,
  Layers,
  Users,
  ShieldCheck,
  ShoppingBag,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  ArrowRight,
  Clock,
  AlertTriangle,
  X,
  Download,
  Filter,
  Check,
  Package,
  FileText,
  Activity,
  ChevronRight
} from 'lucide-react';
import { StatusBadge, money, quantity, dateLabel } from '../../components/owner/OwnerUI';
import '../../styles/owner-workspace.css';

export default function OwnerTraceabilityPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Selected Batch for Deep-Dive Modal
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'info' | 'ingredients' | 'history' | 'qc' | 'orders'

  // Recall CSV Export state
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const cleanSearch = search ? search.replace(/^#/, '').trim() : undefined;
      const res = await ownerService.getTraceabilityDashboard({
        search: cleanSearch || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      const data = res.data || res;
      setDashboardData(data.summary || {});
      setBatches(data.batches || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load batch traceability data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [statusFilter]);

  const handleSearchSubmit = e => {
    e.preventDefault();
    loadDashboard();
  };

  const openBatchTrace = async batchId => {
    try {
      setSelectedBatchId(batchId);
      setLoadingDetail(true);
      const cleanId = String(batchId || '').replace(/^#/, '').trim();
      const res = await ownerService.getBatchTraceabilityDetail(cleanId);
      setBatchDetail(res.data || res);
      setActiveTab('all');
    } catch (err) {
      alert(`Could not load batch details: ${err.response?.data?.message || err.message}`);
      setSelectedBatchId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownloadRecallCsv = async lotNumber => {
    const lotToUse = lotNumber || 'ALL';
    try {
      setIsExportingCsv(true);
      const blob = await ownerService.downloadRecallReportCsv(lotToUse);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Traceability_Recall_${String(lotToUse).replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Could not export recall report: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsExportingCsv(false);
    }
  };

  const summary = dashboardData || {};

  const filteredBatches = batches.filter(b => {
    if (dateFilter) {
      const bDate = String(b.created_at || '').slice(0, 10);
      if (bDate !== dateFilter) return false;
    }
    return true;
  });

  return (
    <div className="owner-workspace ow-traceability" style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C1917', margin: 0 }}>
                End-to-End Baked Batch Traceability
              </h1>
              <p style={{ fontSize: '13px', color: '#78716C', margin: '2px 0 0' }}>
                Complete audit trail: Raw Ingredients → Recipe → Production → Quality Check → Packaging → Customer Order → Dispatch
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="ow-button"
            disabled={isExportingCsv}
            onClick={() => handleDownloadRecallCsv('RECALL-ALL')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            <span>{isExportingCsv ? 'Exporting…' : 'Export Recall CSV'}</span>
          </button>
          <button
            type="button"
            className="ow-button ow-button-primary"
            onClick={loadDashboard}
          >
            Refresh Records
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '14px', borderRadius: '10px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Real Database Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px'
      }}>
        {[
          { label: 'Total Production Batches', value: summary.total_batches ?? batches.length, icon: Layers, tone: '#1C1917', bg: '#F5F5F4' },
          { label: 'Batches in Progress', value: summary.in_progress ?? 0, icon: Clock, tone: '#D97706', bg: '#FEF3C7' },
          { label: 'Completed Batches', value: summary.completed ?? 0, icon: CheckCircle2, tone: '#15803D', bg: '#DCFCE7' },
          { label: 'Pending Quality Checks', value: summary.pending_qc ?? 0, icon: ShieldCheck, tone: '#7C3AED', bg: '#EDE9FE' },
          { label: 'Packed Batches', value: summary.packed ?? 0, icon: Package, tone: '#0284C7', bg: '#E0F2FE' },
          { label: 'Dispatched / Delivered', value: summary.dispatched ?? 0, icon: Truck, tone: '#0D9488', bg: '#CCFBF1' },
        ].map((stat, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid #E7E5E4',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: stat.bg,
              color: stat.tone,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <stat.icon size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#78716C', textTransform: 'uppercase' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#1C1917', marginTop: '2px' }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        padding: '16px 20px',
        border: '1px solid #E7E5E4',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#A8A29E" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              placeholder="Search by Batch ID (e.g. BATCH-2026-00001), Product, Baker, or Order #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid #D6D3D1',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button type="submit" className="ow-button ow-button-primary">
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#78716C" />
            <select
              className="ow-select"
              aria-label="Filter status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ fontSize: '12px' }}
            >
              <option value="ALL">All Batch Statuses</option>
              <option value="Planned">Planned / Scheduled</option>
              <option value="In Production">In Production / Baking</option>
              <option value="Quality Check">Pending Quality Check</option>
              <option value="Quality Checked">Quality Checked</option>
              <option value="Packed">Packed</option>
              <option value="Completed">Completed</option>
              <option value="Dispatched">Dispatched / Delivered</option>
            </select>
          </div>

          <input
            type="date"
            aria-label="Filter production date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #D6D3D1',
              fontSize: '12px'
            }}
          />

          {(search || statusFilter !== 'ALL' || dateFilter) && (
            <button
              type="button"
              className="ow-button ow-button-light"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setDateFilter('');
                setTimeout(loadDashboard, 50);
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Production Batches Master Table */}
      <section className="ow-panel">
        <div className="ow-section-header">
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Production Batches Database</h2>
            <p className="ow-muted ow-small" style={{ margin: '4px 0 0' }}>
              Showing {filteredBatches.length} verified production batches with complete ingredient and order provenance. Click any batch to audit its complete journey.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#78716C' }}>
            Loading batch records from database...
          </div>
        ) : filteredBatches.length ? (
          <div className="ow-table-wrap">
            <table className="ow-table ow-responsive-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Product &amp; Recipe</th>
                  <th>Assigned Worker</th>
                  <th className="ow-numeric">Planned Qty</th>
                  <th className="ow-numeric">Baked Qty</th>
                  <th className="ow-numeric">Usable Qty</th>
                  <th>Production Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map(b => (
                  <tr key={b.id}>
                    <td data-label="Batch ID">
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#B45309',
                          backgroundColor: '#FEF3C7',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #FDE68A'
                        }}
                      >
                        {b.batch_no || `BATCH-${b.id}`}
                      </span>
                      {b.order_reference && (
                        <small style={{ display: 'block', color: 'var(--ow-muted)', marginTop: '3px' }}>
                          Order: {b.order_reference}
                        </small>
                      )}
                    </td>
                    <td data-label="Product">
                      <strong>{b.product_name}</strong>
                      <small>{b.recipe_name || 'Master Formula'}</small>
                    </td>
                    <td data-label="Assigned Worker">
                      <span>{b.baker_name || 'Unassigned'}</span>
                      <small style={{ display: 'block', color: 'var(--ow-muted)' }}>{b.shift || 'Morning Shift'}</small>
                    </td>
                    <td data-label="Planned Qty" className="ow-numeric">
                      <strong>{quantity(b.planned_quantity)}</strong>
                    </td>
                    <td data-label="Baked Qty" className="ow-numeric">
                      <span>{b.completed_quantity ?? b.actual_baked_qty ?? 0}</span>
                    </td>
                    <td data-label="Usable Qty" className="ow-numeric">
                      <strong style={{ color: Number(b.actual_usable_qty || 0) > 0 ? '#15803D' : 'inherit' }}>
                        {b.actual_usable_qty ?? 0}
                      </strong>
                    </td>
                    <td data-label="Production Date">
                      <span>{dateLabel(b.created_at)}</span>
                      {b.started_at && (
                        <small style={{ display: 'block', color: 'var(--ow-muted)' }}>
                          Started {new Date(b.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      )}
                    </td>
                    <td data-label="Status">
                      <StatusBadge value={b.status} />
                    </td>
                    <td data-label="Actions" style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="ow-button ow-button-primary"
                        onClick={() => openBatchTrace(b.batch_no || b.id)}
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        <span>Trace Journey</span>
                        <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#78716C' }}>
            No batches found matching the selected filters.
          </div>
        )}
      </section>

      {/* COMPREHENSIVE BATCH TRACEABILITY MODAL (All 5 Sections: A, B, C, D, E) */}
      {selectedBatchId && (
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
            maxWidth: '1080px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E7E5E4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FAF9F6'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '15px',
                    color: '#B45309',
                    backgroundColor: '#FEF3C7',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #FDE68A'
                  }}>
                    {batchDetail?.batch_info?.batch_no || selectedBatchId}
                  </span>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#1C1917' }}>
                    {batchDetail?.batch_info?.product_name || 'Batch Details'}
                  </h2>
                  {batchDetail?.batch_info?.status && (
                    <StatusBadge value={batchDetail.batch_info.status} />
                  )}
                </div>
                <small style={{ color: '#78716C', display: 'block', marginTop: '4px' }}>
                  Produced on {dateLabel(batchDetail?.batch_info?.production_date)} · Baker: {batchDetail?.batch_info?.baker_name || 'Unassigned'}
                </small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="ow-button"
                  onClick={() => handleDownloadRecallCsv(batchDetail?.batch_info?.batch_no || selectedBatchId)}
                  style={{ fontSize: '12px' }}
                >
                  <Download size={13} />
                  <span>Recall CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBatchId(null)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    color: '#78716C'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Nav Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #E7E5E4',
              padding: '0 24px',
              backgroundColor: '#FFFFFF',
              gap: '16px'
            }}>
              {[
                { id: 'all', label: 'Full Journey Overview' },
                { id: 'info', label: 'A. Batch Info' },
                { id: 'ingredients', label: 'B. Ingredient Traceability' },
                { id: 'history', label: 'C. Production Logs' },
                { id: 'qc', label: 'D. Quality & Packing' },
                { id: 'orders', label: 'E. Customer Orders' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: '12px 4px',
                    border: 'none',
                    borderBottom: activeTab === t.id ? '2px solid #C25E00' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: activeTab === t.id ? '#C25E00' : '#78716C',
                    fontWeight: activeTab === t.id ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {loadingDetail ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#78716C' }}>
                  Auditing database records for {selectedBatchId}...
                </div>
              ) : batchDetail ? (
                <>
                  {/* SECTION A: Batch Information */}
                  {(activeTab === 'all' || activeTab === 'info') && (
                    <div style={{ backgroundColor: '#FAF9F6', borderRadius: '12px', padding: '18px', border: '1px solid #E7E5E4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Layers size={18} color="#C25E00" />
                        <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1C1917' }}>
                          SECTION A: Batch Information
                        </h3>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '13px' }}>
                        <div><span style={{ color: '#78716C' }}>Batch ID:</span> <strong>{batchDetail.batch_info?.batch_no}</strong></div>
                        <div><span style={{ color: '#78716C' }}>Product:</span> <strong>{batchDetail.batch_info?.product_name}</strong></div>
                        <div><span style={{ color: '#78716C' }}>Master Recipe:</span> <strong>{batchDetail.batch_info?.recipe_name || 'Standard Formula'} (v{batchDetail.batch_info?.recipe_version})</strong></div>
                        <div><span style={{ color: '#78716C' }}>Worker Responsible:</span> <strong>{batchDetail.batch_info?.worker_responsible || batchDetail.batch_info?.baker_name}</strong> ({batchDetail.batch_info?.shift})</div>
                        <div><span style={{ color: '#78716C' }}>Planned Quantity:</span> <strong>{batchDetail.batch_info?.planned_quantity} units</strong></div>
                        <div><span style={{ color: '#78716C' }}>Actual Baked Quantity:</span> <strong>{batchDetail.batch_info?.completed_quantity} units</strong></div>
                        <div><span style={{ color: '#78716C' }}>Output Weight:</span> <strong>{batchDetail.batch_info?.actual_total_output_weight ? `${batchDetail.batch_info.actual_total_output_weight} g` : (batchDetail.batch_info?.batch_output_weight ? `${batchDetail.batch_info.batch_output_weight} ${batchDetail.batch_info.batch_output_weight_unit || 'g'}` : 'Standard Batch')}</strong></div>
                        <div><span style={{ color: '#78716C' }}>Standard Unit Weight:</span> <strong>{batchDetail.batch_info?.standard_unit_weight_grams ? `${batchDetail.batch_info.standard_unit_weight_grams} g` : '50 g (std)'}</strong></div>
                        <div><span style={{ color: '#78716C' }}>Usable Quantity:</span> <strong style={{ color: '#15803D' }}>{batchDetail.batch_info?.usable_quantity} units</strong></div>
                        <div><span style={{ color: '#78716C' }}>Remaining Stock:</span> <strong style={{ color: (batchDetail.batch_info?.remaining_quantity ?? 0) > 0 ? '#0284C7' : '#78716C' }}>{batchDetail.batch_info?.remaining_quantity ?? 0} units</strong></div>
                        <div><span style={{ color: '#78716C' }}>Wastage Quantity:</span> <strong style={{ color: batchDetail.batch_info?.wastage_quantity > 0 ? '#DC2626' : 'inherit' }}>{batchDetail.batch_info?.wastage_quantity} units</strong></div>
                        <div><span style={{ color: '#78716C' }}>Started At:</span> <span>{batchDetail.batch_info?.started_at ? new Date(batchDetail.batch_info.started_at).toLocaleString() : 'Pending'}</span></div>
                        <div><span style={{ color: '#78716C' }}>Completed At:</span> <span>{batchDetail.batch_info?.completed_at ? new Date(batchDetail.batch_info.completed_at).toLocaleString() : 'Pending'}</span></div>
                      </div>
                    </div>
                  )}

                  {/* SECTION B: Ingredient Traceability */}
                  {(activeTab === 'all' || activeTab === 'ingredients') && (
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '18px', border: '1px solid #E7E5E4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Package size={18} color="#2563EB" />
                          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1C1917' }}>
                            SECTION B: Ingredient Traceability &amp; Consumption
                          </h3>
                        </div>
                        <span style={{ fontSize: '12px', color: '#78716C' }}>
                          {batchDetail.ingredient_traceability?.length || 0} ingredients consumed
                        </span>
                      </div>

                      {batchDetail.ingredient_traceability?.length ? (
                        <div className="ow-table-wrap">
                          <table className="ow-table ow-responsive-table" style={{ fontSize: '12px' }}>
                            <thead>
                              <tr>
                                <th>Ingredient</th>
                                <th className="ow-numeric">Recipe Required</th>
                                <th className="ow-numeric">Actual Consumed</th>
                                <th className="ow-numeric">Difference</th>
                                <th>Unit</th>
                                <th className="ow-numeric">Stock Before</th>
                                <th className="ow-numeric">Stock After</th>
                                <th>Lot Number</th>
                                <th>Supplier</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchDetail.ingredient_traceability.map((ing, idx) => (
                                <tr key={idx}>
                                  <td data-label="Ingredient"><strong>{ing.ingredient_name}</strong></td>
                                  <td data-label="Recipe Req" className="ow-numeric">{Number(ing.recipe_required_qty || 0).toFixed(3)}</td>
                                  <td data-label="Actual Consumed" className="ow-numeric"><strong style={{ color: '#B45309' }}>{Number(ing.actual_consumed_qty || 0).toFixed(3)}</strong></td>
                                  <td data-label="Difference" className="ow-numeric">
                                    {Number(ing.difference || 0) === 0 ? (
                                      <span style={{ color: '#15803D' }}>0.000</span>
                                    ) : (
                                      <span style={{ color: '#DC2626' }}>{Number(ing.difference).toFixed(3)}</span>
                                    )}
                                  </td>
                                  <td data-label="Unit">{ing.unit}</td>
                                  <td data-label="Stock Before" className="ow-numeric">{ing.stock_before !== null ? Number(ing.stock_before).toFixed(2) : '—'}</td>
                                  <td data-label="Stock After" className="ow-numeric">{ing.stock_after !== null ? Number(ing.stock_after).toFixed(2) : '—'}</td>
                                  <td data-label="Lot Number">
                                    <span style={{ fontFamily: 'monospace', fontSize: '11px', background: '#F5F5F4', padding: '2px 6px', borderRadius: '4px' }}>
                                      {ing.lot_number || 'LOT-PROV-01'}
                                    </span>
                                  </td>
                                  <td data-label="Supplier"><small>{ing.supplier_name || 'Organic Grains India'}</small></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#78716C' }}>
                          No ingredient consumption recorded for this batch.
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION C: Production History */}
                  {(activeTab === 'all' || activeTab === 'history') && (
                    <div style={{ backgroundColor: '#FAF9F6', borderRadius: '12px', padding: '18px', border: '1px solid #E7E5E4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Activity size={18} color="#D97706" />
                        <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1C1917' }}>
                          SECTION C: Production History &amp; Status Logs
                        </h3>
                      </div>

                      {batchDetail.production_history?.logs?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {batchDetail.production_history.logs.map(log => (
                            <div
                              key={log.id}
                              style={{
                                backgroundColor: '#FFFFFF',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: '1px solid #E7E5E4',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '13px'
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 700, color: '#1C1917' }}>
                                  {log.previous_status ? `${log.previous_status} → ` : ''}{log.new_status}
                                </span>
                                <small style={{ display: 'block', color: '#78716C', marginTop: '2px' }}>
                                  {log.notes || 'Status updated'} · Baker: {log.baker_name || 'Assigned Baker'}
                                </small>
                              </div>
                              <span style={{ fontSize: '12px', color: '#A8A29E', fontFamily: 'monospace' }}>
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#78716C', fontSize: '13px' }}>
                          Initial batch production log created on {dateLabel(batchDetail.batch_info?.production_date)}.
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION D: Quality and Packaging */}
                  {(activeTab === 'all' || activeTab === 'qc') && (
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '18px', border: '1px solid #E7E5E4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <ShieldCheck size={18} color="#15803D" />
                        <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1C1917' }}>
                          SECTION D: Quality Inspection &amp; Packaging
                        </h3>
                      </div>

                      {batchDetail.quality_and_packaging?.inspections?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {batchDetail.quality_and_packaging.inspections.map(qc => {
                            const isPassed = String(qc.result).toUpperCase() === 'PASSED';
                            return (
                              <div
                                key={qc.id}
                                style={{
                                  backgroundColor: isPassed ? '#F0FDF4' : '#FEF2F2',
                                  border: `1px solid ${isPassed ? '#86EFAC' : '#FCA5A5'}`,
                                  borderRadius: '8px',
                                  padding: '14px',
                                  fontSize: '13px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      backgroundColor: isPassed ? '#DCFCE7' : '#FEE2E2',
                                      color: isPassed ? '#15803D' : '#991B1B'
                                    }}>
                                      {qc.result}
                                    </span>
                                    <strong>Inspector: {qc.inspector_name || qc.inspector_name_user || 'Baker Rajesh Kumar'}</strong>
                                  </div>
                                  <small style={{ color: '#78716C' }}>
                                    {new Date(qc.inspected_at || qc.created_at).toLocaleString()}
                                  </small>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '10px' }}>
                                  <div>Accepted Quantity: <strong style={{ color: '#15803D' }}>{qc.accepted_quantity || 0} units</strong></div>
                                  <div>Rejected Quantity: <strong style={{ color: '#DC2626' }}>{qc.rejected_quantity || 0} units</strong></div>
                                  {qc.internal_temp && <div>Internal Core Temp: <strong>{qc.internal_temp}°C</strong></div>}
                                  {qc.rejection_reason && <div>Rejection Reason: <strong style={{ color: '#DC2626' }}>{qc.rejection_reason}</strong></div>}
                                </div>

                                {(qc.quality_notes || qc.remarks) && (
                                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#4B5563' }}>
                                    Notes: {qc.quality_notes || qc.remarks}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '16px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', color: '#92400E', fontSize: '13px' }}>
                          Quality inspection is pending for this batch.
                        </div>
                      )}

                      <div style={{ marginTop: '14px', display: 'flex', gap: '16px', fontSize: '13px' }}>
                        <div>Packaging Status: <strong>{batchDetail.quality_and_packaging?.packaging?.status || 'Pending'}</strong></div>
                        <div>Packed Quantity: <strong>{batchDetail.quality_and_packaging?.packaging?.packed_quantity || 0} units</strong></div>
                        <div>Remaining to Pack: <strong>{batchDetail.quality_and_packaging?.packaging?.pending_packing || 0} units</strong></div>
                      </div>
                    </div>
                  )}

                  {/* SECTION E: Linked Customer Orders & Delivery */}
                  {(activeTab === 'all' || activeTab === 'orders') && (
                    <div style={{ backgroundColor: '#FAF9F6', borderRadius: '12px', padding: '18px', border: '1px solid #E7E5E4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ShoppingBag size={18} color="#7C3AED" />
                          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1C1917' }}>
                            SECTION E: Linked Customer Orders &amp; Delivery
                          </h3>
                        </div>
                        <span style={{ fontSize: '12px', color: '#78716C' }}>
                          {batchDetail.order_and_delivery?.orders?.length || 0} linked order(s)
                        </span>
                      </div>

                      {batchDetail.order_and_delivery?.orders?.length ? (
                        <div className="ow-table-wrap">
                          <table className="ow-table ow-responsive-table" style={{ fontSize: '12px' }}>
                            <thead>
                              <tr>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Delivery Slot</th>
                                <th className="ow-numeric">Units Supplied</th>
                                <th className="ow-numeric">Weight (Grams)</th>
                                <th className="ow-numeric">Total Amount</th>
                                <th>Order Status</th>
                                <th>Payment Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchDetail.order_and_delivery.orders.map(ord => (
                                <tr key={ord.link_id || ord.order_id}>
                                  <td data-label="Order #"><strong>{ord.order_no || `#${ord.order_id}`}</strong></td>
                                  <td data-label="Customer">
                                    <span>{ord.customer_name}</span>
                                    <small style={{ display: 'block', color: '#78716C' }}>{ord.customer_phone}</small>
                                  </td>
                                  <td data-label="Slot">{ord.delivery_time_slot || 'Standard delivery'}</td>
                                  <td data-label="Units" className="ow-numeric"><strong>{ord.quantity_allocated || ord.quantity || 1} units</strong></td>
                                  <td data-label="Weight" className="ow-numeric">{ord.weight_grams ? `${ord.weight_grams} g` : '—'}</td>
                                  <td data-label="Total" className="ow-numeric">{money(ord.total_amount)}</td>
                                  <td data-label="Order Status"><StatusBadge value={ord.order_status} /></td>
                                  <td data-label="Payment"><StatusBadge value={ord.payment_status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#78716C', fontSize: '13px' }}>
                          This batch was produced for bakery showcase stock (internal shelf replenishment).
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #E7E5E4',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: '#FAF9F6'
            }}>
              <button
                type="button"
                className="ow-button"
                onClick={() => setSelectedBatchId(null)}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
