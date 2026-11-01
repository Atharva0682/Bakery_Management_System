import React, { useState, useEffect } from 'react';
import staffService from '../../services/staffService';
import {
  Layers,
  Trash2,
  Clock,
  CheckCircle2,
  Check,
  RefreshCw,
  Plus,
  ShieldCheck,
  Package,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { PageHeader, RefreshButton, MetricStrip, StatusBadge } from '../../components/owner/OwnerUI';
import '../../styles/owner-workspace.css';

const REASON_OPTIONS = [
  'Burnt in Deck Oven',
  'Spill / Dropped',
  'Undercooked Center',
  'Incorrect Texture / Proofing Issue',
  'Ingredient Weighing Error',
  'Damaged During Handling',
  'Overproduction (Defective)',
  'Other'
];

const StaffBatchesWastagePage = () => {
  const [batches, setBatches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wastageHistory, setWastageHistory] = useState([]);
  const [summary, setSummary] = useState(null);

  // Form State
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [productName, setProductName] = useState('');
  const [qtyWasted, setQtyWasted] = useState('0');
  const [unit, setUnit] = useState('pcs');
  const [reason, setReason] = useState('Burnt in Deck Oven');
  const [notes, setNotes] = useState('');
  const [surplusBufferQty, setSurplusBufferQty] = useState('0');
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [batchData, orderData, histData, sumData] = await Promise.all([
        staffService.getBatches().catch(() => []),
        staffService.getAllOrders().catch(() => ({ data: [] })),
        staffService.getWastageHistory().catch(() => []),
        staffService.getTodayWastageSummary().catch(() => null)
      ]);

      const bList = Array.isArray(batchData) ? batchData : batchData?.data || [];
      const oList = Array.isArray(orderData) ? orderData : orderData?.data || [];
      const hList = Array.isArray(histData) ? histData : histData?.data || [];

      setBatches(bList);
      setOrders(oList);
      setWastageHistory(hList);
      setSummary(sumData);

      if (bList.length > 0 && !selectedBatchId) {
        setSelectedBatchId(String(bList[0].id));
        setProductName(bList[0].product_name || '');
      }
    } catch (err) {
      console.error('Error loading batches and wastage:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('crumbco:staff-refresh', handleRefresh);
    return () => window.removeEventListener('crumbco:staff-refresh', handleRefresh);
  }, []);

  // Sync product name when batch changes
  useEffect(() => {
    if (selectedBatchId) {
      const matched = batches.find(b => String(b.id) === String(selectedBatchId));
      if (matched && matched.product_name) {
        setProductName(matched.product_name);
      }
    }
  }, [selectedBatchId, batches]);

  const handleLogWastageAndBuffer = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const wastedNum = parseFloat(qtyWasted) || 0;
    const surplusNum = parseFloat(surplusBufferQty) || 0;

    if (wastedNum <= 0 && surplusNum <= 0) {
      setErrorMessage('Please specify either a wastage quantity or good-quality buffer surplus quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      await staffService.recordWastage({
        batch_id: selectedBatchId || null,
        order_id: selectedOrderId || null,
        product_name: productName || 'Artisanal Baked Item',
        quantity_wasted: wastedNum,
        unit,
        reason: wastedNum > 0 ? reason : 'Buffer Stock Yield Surplus',
        notes: notes || 'Floor recorded output and surplus buffer allocation',
        surplus_buffer_quantity: surplusNum,
        expiry_date: surplusNum > 0 ? expiryDate : null
      });

      setSuccessMessage(
        `Logged successfully: ${wastedNum > 0 ? `${wastedNum} ${unit} scrap` : ''}${
          wastedNum > 0 && surplusNum > 0 ? ' and ' : ''
        }${surplusNum > 0 ? `${surplusNum} ${unit} good-quality surplus added to buffer stock` : ''}.`
      );
      setTimeout(() => setSuccessMessage(''), 5000);

      // Reset quantities to prevent double submit
      setQtyWasted('0');
      setSurplusBufferQty('0');
      setNotes('');
      await loadData();
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to record entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBatch = batches.find(b => String(b.id) === String(selectedBatchId));

  const todayScrapQty = wastageHistory.reduce((sum, log) => sum + (parseFloat(log.quantity_wasted) || 0), 0);
  const todayBufferQty = wastageHistory.reduce((sum, log) => sum + (parseFloat(log.surplus_buffer_quantity) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {successMessage && (
        <div style={{
          backgroundColor: '#F0FDF4',
          border: '1px solid #86EFAC',
          color: '#166534',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          color: '#DC2626',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Module 3 Top Header (Owner UI Design System) */}
      <PageHeader
        eyebrow="Kitchen Inventory · Yield Management"
        title="Wastage & Buffer Control"
        description="Separate logging of production scrap and good-quality surplus yields intended for retail buffer stock."
      >
        <RefreshButton onClick={loadData} loading={isRefreshing} />
      </PageHeader>

      {/* Floor Overview Metric Strip (Owner UI Design System) */}
      <MetricStrip items={[
        {
          icon: Layers,
          label: 'Active Batches',
          value: batches.length,
          note: 'Batches on floor schedule'
        },
        {
          icon: Trash2,
          label: 'Floor Scrap Today',
          value: `${todayScrapQty} ${summary?.unit || 'pcs'}`,
          note: 'Logged production scrap loss'
        },
        {
          icon: ShieldCheck,
          label: 'Buffer Surplus Added',
          value: `+${todayBufferQty} pcs`,
          note: 'Usable stock staged for retail'
        },
        {
          icon: CheckCircle2,
          label: 'Floor QA Compliance',
          value: '100%',
          note: 'Scrap & buffer segregated'
        }
      ]} />

      {/* Main Grid: Left Timeline & Batches, Right Combined Wastage & Buffer Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1.7fr)', gap: '24px' }}>
        
        {/* Left Column: Batches Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EFE6DC',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(46, 34, 29, 0.04)'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2E221D', marginBottom: '14px' }}>
              Active Batches & Usable Yield
            </h2>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: '#8E7C72', borderBottom: '1px solid #EFE6DC', fontSize: '12px' }}>
                    <th style={{ padding: '8px 0' }}>Product</th>
                    <th style={{ padding: '8px 8px' }}>Batch</th>
                    <th style={{ padding: '8px 8px' }}>Planned</th>
                    <th style={{ padding: '8px 8px' }}>Usable Buffer</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      onClick={() => {
                        setSelectedBatchId(String(batch.id));
                        setProductName(batch.product_name);
                      }}
                      style={{
                        borderBottom: '1px solid #FAF6F0',
                        cursor: 'pointer',
                        backgroundColor: String(batch.id) === String(selectedBatchId) ? '#FDF9F5' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 0', fontWeight: 600, color: '#2E221D' }}>
                        {batch.product_name}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#8B5A2B', fontWeight: 600 }}>
                        #{batch.batch_no || batch.batch_code}
                      </td>
                      <td style={{ padding: '10px 8px' }}>{batch.planned_quantity} pcs</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: '#16A34A' }}>
                        {batch.actual_usable_qty || batch.completed_quantity || 0} pcs
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: ['In Production', 'Baking'].includes(batch.status) ? '#FEF3C7' : batch.status === 'Completed' ? '#DCFCE7' : '#F5EFEB',
                          color: ['In Production', 'Baking'].includes(batch.status) ? '#B45309' : batch.status === 'Completed' ? '#15803D' : '#5E4E45'
                        }}>
                          {batch.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Guidelines Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EFE6DC',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(46, 34, 29, 0.04)'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#2E221D', marginBottom: '6px' }}>
              Floor Separation Rules
            </h3>
            <p style={{ fontSize: '12px', color: '#8E7C72', margin: '0 0 10px' }}>
              Ensure defective scrap and retail-grade buffer stock remain strictly segregated:
            </p>
            <ul style={{ fontSize: '12px', color: '#5E4E45', paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
              <li><strong>Wastage Scrap:</strong> Burnt crusts, fallen dough, or dropped items discarded to waste bins.</li>
              <li><strong>Good-Quality Surplus:</strong> Excess baked loaves/pastries meeting 100% QA criteria transferred to retail counter buffer stock.</li>
            </ul>
          </div>

          {/* Shift Floor Audit History (Positioned below Floor Separation Rules at the empty space) */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EFE6DC',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(46, 34, 29, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#2E221D', margin: 0 }}>
                Shift Floor Audit History
              </h3>
              <span style={{ fontSize: '11px', color: '#8E7C72', fontWeight: 600 }}>
                {wastageHistory.length} Recorded
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {wastageHistory.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#8E7C72', margin: 0 }}>No entries recorded for this shift yet.</p>
              ) : (
                wastageHistory.slice(0, 8).map((log, idx) => (
                  <div key={log.id || idx} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #FAF6F0', backgroundColor: '#FDF9F5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#2E221D' }}>
                        {log.product_name || log.ingredient_name || 'Production Batch'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#8E7C72' }}>
                        {new Date(log.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', marginTop: '4px' }}>
                      {log.quantity_wasted > 0 && (
                        <span style={{ color: '#DC2626', fontWeight: 600 }}>
                          Scrap: {log.quantity_wasted} {log.unit} ({log.reason})
                        </span>
                      )}
                      {log.surplus_buffer_quantity > 0 && (
                        <span style={{ color: '#16A34A', fontWeight: 600 }}>
                          Buffer Added: +{log.surplus_buffer_quantity} {log.unit}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Combined Wastage & Good Surplus Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #EFE6DC',
            padding: '22px',
            boxShadow: '0 2px 8px rgba(46, 34, 29, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#2E221D' }}>
                Record Floor Scrap & Buffer Surplus
              </h2>
              <span style={{ fontSize: '12px', color: '#8E7C72', fontWeight: 600 }}>Floor Standard</span>
            </div>
            <p style={{ fontSize: '12px', color: '#8E7C72', marginBottom: '16px' }}>
              Single submission workflow to log defective scrap loss and transfer verified usable excess to buffer inventory.
            </p>

            <form onSubmit={handleLogWastageAndBuffer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Batch & Order Linkage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                    Production Batch
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #EFE6DC',
                      fontSize: '13px',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value="">-- No specific batch --</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.product_name} (#{b.batch_no || b.batch_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                    Linked Customer Order (Optional)
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #EFE6DC',
                      fontSize: '13px',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value="">-- No order reference --</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        Order #{o.order_no || o.id} - {o.guest_name || 'Customer'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product / Material Name & Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                    Product or Raw Material Name
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Sourdough Loaf, Butter Croissant, Whole Flour"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #EFE6DC',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #EFE6DC',
                      fontSize: '13px',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value="pcs">pcs (loaves/pastries)</option>
                    <option value="g">grams (g)</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="L">Liters (L)</option>
                  </select>
                </div>
              </div>

              {/* SECTION A: WASTAGE (SCRAP) */}
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                  <Trash2 size={16} />
                  <span>Defective Wastage (Unusable Scrap)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#B91C1C', marginBottom: '4px' }}>
                      Quantity Wasted
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={qtyWasted}
                      onChange={(e) => setQtyWasted(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #FCA5A5',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#B91C1C', marginBottom: '4px' }}>
                      Reason for Loss
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #FCA5A5',
                        fontSize: '13px',
                        backgroundColor: '#FFFFFF'
                      }}
                    >
                      {REASON_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION B: GOOD-QUALITY SURPLUS (BUFFER STOCK) */}
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: '1px solid #DCFCE7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                  <ShieldCheck size={16} />
                  <span>Good-Quality Surplus (Usable Buffer Stock)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#15803D', marginBottom: '4px' }}>
                      Surplus Quantity Produced
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={surplusBufferQty}
                      onChange={(e) => setSurplusBufferQty(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #86EFAC',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#15803D', marginBottom: '4px' }}>
                      Use-by / Expiry Date
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #86EFAC',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                  Shift Notes & Baker Observation
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="E.g. Deck oven temp calibration normal; 2 surplus loaves cooled on wire rack and staged for retail."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #EFE6DC',
                    fontSize: '13px'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  backgroundColor: '#AD642E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Saving to Floor Audit...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Submit Wastage & Buffer Record</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffBatchesWastagePage;
