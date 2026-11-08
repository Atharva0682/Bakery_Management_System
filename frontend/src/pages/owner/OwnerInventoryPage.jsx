import React, { useState, useEffect } from 'react';
import ownerService from '../../services/ownerService';
import staffService from '../../services/staffService';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Plus,
  ArrowUpDown,
  Truck
} from 'lucide-react';

const OwnerInventoryPage = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [requisitions, setRequisitions] = useState([]);
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqMaterial, setReqMaterial] = useState('');
  const [reqQty, setReqQty] = useState('');
  const [reqUrgency, setReqUrgency] = useState('Normal');
  const [reqNotes, setReqNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadInventory = async () => {
    try {
      setLoading(true);
      const [ingRes, reqRes] = await Promise.all([
        ownerService.getInventory().catch(() => []),
        staffService.getRequisitions().catch(() => [])
      ]);
      setIngredients(ingRes.data || ingRes || []);
      setRequisitions(reqRes.data || reqRes || []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleCreateRequisition = async (e) => {
    e.preventDefault();
    if (!reqMaterial || !reqQty) return;
    try {
      await staffService.createRequisition({
        material_name: reqMaterial,
        quantity: parseFloat(reqQty),
        unit: 'kg',
        urgency: reqUrgency,
        notes: reqNotes
      });
      setActionSuccess(`Stock requisition for ${reqMaterial} submitted!`);
      setTimeout(() => setActionSuccess(''), 4000);
      setShowReqModal(false);
      setReqMaterial('');
      setReqQty('');
      setReqNotes('');
      await loadInventory();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to submit requisition');
    }
  };

  const filtered = ingredients.filter(item => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch = !search ||
      item.material_name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const shortages = ingredients.filter(i => i.status === 'Low Stock' || i.status === 'Out of Stock');

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Alert */}
      {actionSuccess && (
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
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header */}
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
              <Package size={20} />
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              Raw Materials Floor Stock & Inventory Lots
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#78716C', margin: '6px 0 0 44px' }}>
            Monitor ingredient stock levels, expiration schedules, supplier lots, and floor purchase requisitions.
          </p>
        </div>

        <button
          onClick={() => setShowReqModal(true)}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            backgroundColor: '#C25E00',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 6px rgba(194, 94, 0, 0.25)'
          }}
        >
          <Plus size={16} /> New Stock Requisition
        </button>
      </div>

      {/* Shortage Alert Banner if items low */}
      {shortages.length > 0 && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#DC2626" />
            <div>
              <strong style={{ fontSize: '14px', color: '#991B1B' }}>
                Inventory Shortage Alert: {shortages.length} raw materials below safety threshold!
              </strong>
              <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                Items: {shortages.map(s => `${s.material_name} (${s.current_stock} ${s.unit})`).join(', ')}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setReqMaterial(shortages[0]?.material_name || '');
              setShowReqModal(true);
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reorder Critical Materials
          </button>
        </div>
      )}

      {/* Category Pills & Search Filter */}
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
          {['ALL', 'Flours & Grains', 'Dairy & Fats', 'Sugars & Sweeteners', 'Inclusions & Spices'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: selectedCategory === cat ? '#1C1917' : '#F5F5F4',
                color: selectedCategory === cat ? '#FFFFFF' : '#78716C',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={15} color="#A8A29E" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            placeholder="Search material or SKU..."
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

      {/* Inventory Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E7E5E4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#78716C' }}>
            Loading floor raw materials inventory...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAF9F6', borderBottom: '1px solid #E7E5E4', textAlign: 'left', color: '#78716C' }}>
                  <th style={{ padding: '12px 16px' }}>SKU</th>
                  <th style={{ padding: '12px 16px' }}>Raw Material</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Current Stock</th>
                  <th style={{ padding: '12px 16px' }}>Safety Reorder</th>
                  <th style={{ padding: '12px 16px' }}>Unit Cost</th>
                  <th style={{ padding: '12px 16px' }}>Stock Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  let badgeBg = '#DCFCE7';
                  let badgeColor = '#15803D';
                  if (item.status === 'Low Stock') { badgeBg = '#FEF3C7'; badgeColor = '#92400E'; }
                  if (item.status === 'Out of Stock') { badgeBg = '#FEE2E2'; badgeColor = '#991B1B'; }

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F5F5F4' }}>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '11px', color: '#78716C' }}>
                        {item.sku || `RM-00${item.id}`}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 'bold', color: '#1C1917' }}>{item.material_name}</div>
                        <div style={{ fontSize: '11px', color: '#78716C' }}>
                          Supplier: {item.supplier_name || 'Agro Mills India'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#44403C' }}>
                        {item.category}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <strong style={{ fontSize: '14px', color: item.status === 'Out of Stock' ? '#DC2626' : '#1C1917' }}>
                          {item.current_stock}
                        </strong> {item.unit}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#78716C' }}>
                        {item.minimum_stock} {item.unit}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1C1917' }}>
                        ₹{item.unit_cost || 45} / {item.unit}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: badgeBg,
                          color: badgeColor
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setReqMaterial(item.material_name);
                            setShowReqModal(true);
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#FAFAF9',
                            border: '1px solid #D6D3D1',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#C25E00',
                            cursor: 'pointer'
                          }}
                        >
                          Request Reorder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Requisition Modal */}
      {showReqModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px' }}>
              Create Stock Purchase Requisition
            </h3>

            <form onSubmit={handleCreateRequisition} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                  Raw Material *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Bread Flour (T65)"
                  value={reqMaterial}
                  onChange={(e) => setReqMaterial(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                    Required Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 50"
                    value={reqQty}
                    onChange={(e) => setReqQty(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                    Urgency Priority
                  </label>
                  <select
                    value={reqUrgency}
                    onChange={(e) => setReqUrgency(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="Normal">Normal (24h delivery)</option>
                    <option value="High">High (Same-day replenishment)</option>
                    <option value="Critical">Critical (Immediate deck halt)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                  Procurement Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. For tomorrow morning sourdough bulk bake."
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D6D3D1', backgroundColor: '#FFFFFF', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#C25E00', color: '#FFFFFF', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerInventoryPage;
