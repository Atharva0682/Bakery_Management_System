import React, { useState, useEffect } from 'react';
import ownerService from '../../services/ownerService';
import staffService from '../../services/staffService';
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
  Plus
} from 'lucide-react';

const OwnerBatchesPage = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState('');

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
      {/* Toast Alert */}
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
              backgroundColor: '#FEF3C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D97706'
            }}>
              <Layers size={20} />
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              Production Batches & Floor Scheduling Board
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#78716C', margin: '6px 0 0 44px' }}>
            Monitor artisanal oven batches, yield progression, assigned bakers, and linked customer order demand.
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
          <span>Refresh Batches</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        padding: '16px',
        border: '1px solid #E7E5E4',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {['ALL', 'Planned', 'Accepted', 'In Production', 'Packaged', 'Completed'].map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: statusFilter === tab ? '#1C1917' : '#F5F5F4',
                color: statusFilter === tab ? '#FFFFFF' : '#78716C',
                whiteSpace: 'nowrap'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={15} color="#A8A29E" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            placeholder="Search batch # or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: '8px',
              border: '1px solid #D6D3D1',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Batches Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E7E5E4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#78716C' }}>
            Loading production batches...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#78716C' }}>
            No batches found in this category.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAF9F6', borderBottom: '1px solid #E7E5E4', textAlign: 'left', color: '#78716C' }}>
                  <th style={{ padding: '12px 16px' }}>Batch Code</th>
                  <th style={{ padding: '12px 16px' }}>Product</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Baker</th>
                  <th style={{ padding: '12px 16px' }}>Scheduled Start</th>
                  <th style={{ padding: '12px 16px' }}>Target vs Baked</th>
                  <th style={{ padding: '12px 16px' }}>Source Demand</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F5F5F4' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px', backgroundColor: '#1C1917', color: '#FDE68A', padding: '3px 8px', borderRadius: '4px' }}>
                        {b.batch_no || b.batch_code}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: '#1C1917' }}>{b.product_name}</strong>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#44403C' }}>
                      {b.baker_name || 'Rajesh Kumar (Baker)'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#78716C', fontSize: '12px' }}>
                      {b.scheduled_start || '06:00 AM'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: '#1C1917' }}>{b.completed_quantity || 0}</strong> / {b.planned_quantity} pcs
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#78716C' }}>
                      {b.source_orders ? (Array.isArray(b.source_orders) ? b.source_orders.join(', ') : b.source_orders) : '#CC-4112'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {getStatusBadge(b.status)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
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
                            Pack (Completed & Packed)
                          </button>
                        )}
                        {['Packaged', 'Packaging', 'Product Packed', 'Product Completed & Packed'].includes(b.status) && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'Completed')}
                            style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#16A34A', color: '#FFFFFF', border: 'none', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Dispatch / Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerBatchesPage;
