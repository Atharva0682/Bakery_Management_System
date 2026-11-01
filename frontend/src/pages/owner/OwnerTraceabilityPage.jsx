import React, { useState, useEffect } from 'react';
import ownerService from '../../services/ownerService';
import {
  Search,
  Truck,
  Layers,
  Users,
  ShieldCheck,
  ShoppingBag,
  MessageSquare,
  Star,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  ArrowDown,
  Sparkles,
  Info,
  Download
} from 'lucide-react';

const OwnerTraceabilityPage = () => {
  const [searchQuery, setSearchQuery] = useState('BC-5082');
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDownloadingRecall, setIsDownloadingRecall] = useState(false);
  const [error, setError] = useState('');

  const executeTrace = async (queryToUse) => {
    const q = queryToUse || searchQuery;
    if (!q) return;
    try {
      setLoading(true);
      setError('');
      const res = await ownerService.getTraceability(q);
      const data = res.data || res;
      setTraceData(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Traceability search failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeTrace('BC-5082');
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeTrace();
  };

  const handleDownloadRecallCsv = async () => {
    const lotNo = trace?.supplier?.lot_number || searchQuery;
    if (!lotNo) return;
    try {
      setIsDownloadingRecall(true);
      const blob = await ownerService.downloadRecallReportCsv(lotNo);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Recall_Report_${lotNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Could not export recall report: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDownloadingRecall(false);
    }
  };

  const trace = traceData?.trace;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
              <Search size={20} />
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              End-to-End Batch & Food Safety Traceability Audit
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#78716C', margin: '6px 0 0 44px' }}>
            Instant chain-of-custody verification: Supplier Lot → Raw Material → Production Batch → Workers → Quality Check → Customer Order → Feedback.
          </p>
        </div>
      </div>

      {/* Interactive Search Console */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #E7E5E4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={18} color="#A8A29E" style={{ position: 'absolute', left: '14px', top: '14px' }} />
            <input
              type="text"
              required
              placeholder="Search by Batch Code (e.g. BC-5082), Lot # (e.g. LOT-SFM-2026-8812), or Order # (e.g. #CC-4112)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: '10px',
                border: '1px solid #D6D3D1',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              backgroundColor: '#C25E00',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(194, 94, 0, 0.25)'
            }}
          >
            {loading ? 'Auditing Trace...' : 'Trace Full Chain'}
          </button>
        </form>

        {/* Quick Example Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#78716C', fontWeight: 600 }}>Quick Audit Queries:</span>
          {['BC-5082', '#CC-4112', 'LOT-SFM-2026-8812', 'LOT-AMUL-2026-4401', 'NS-055', 'CB-101'].map(sample => (
            <button
              key={sample}
              type="button"
              onClick={() => {
                setSearchQuery(sample);
                executeTrace(sample);
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #E7E5E4',
                backgroundColor: sample.startsWith('LOT') ? '#EFF6FF' : '#FAF9F6',
                color: sample.startsWith('LOT') ? '#1D4ED8' : '#1C1917',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '14px', borderRadius: '10px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {traceData?.limitations && <p role="status">{traceData.limitations}</p>}
      {/* Traceability Chain Visualizer */}
      {trace && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          
          {/* STEP 1: Supplier & Procurement Lot */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E7E5E4',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Truck size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>
                  STEP 1: RAW MATERIAL PROCUREMENT & SUPPLIER LOT
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleDownloadRecallCsv}
                    disabled={isDownloadingRecall}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#FEF2F2',
                      color: '#B91C1C',
                      border: '1px solid #FCA5A5',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Export official Food Safety Recall CSV with affected batches and customer contacts"
                  >
                    <Download size={13} />
                    {isDownloadingRecall ? 'Exporting...' : 'Export Recall Report (CSV)'}
                  </button>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '4px' }}>
                    Stored lot record
                  </span>
                </div>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1C1917', margin: '4px 0 2px' }}>
                {trace.supplier?.name} • {trace.supplier?.material}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px', color: '#57534E', marginTop: '8px' }}>
                <div>Supplier Lot: <strong style={{ fontFamily: 'monospace' }}>{trace.supplier?.lot_number}</strong></div>
                <div>FSSAI License: <strong>{trace.supplier?.license}</strong></div>
                <div>Receipt Date: <strong>{trace.supplier?.received_date}</strong></div>
                <div>Expiry Date: <strong style={{ color: '#059669' }}>{trace.supplier?.expiry_date}</strong></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowDown size={20} color="#A8A29E" />
          </div>

          {/* STEP 2: Production Batch Details */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E7E5E4',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Layers size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>
                  STEP 2: FLOOR PRODUCTION BATCH & OVEN CYCLE
                </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', backgroundColor: '#1C1917', color: '#FDE68A', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                  {trace.batch?.batch_code}
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1C1917', margin: '4px 0 2px' }}>
                {trace.batch?.product_name} ({trace.batch?.planned_qty} units scheduled)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px', color: '#57534E', marginTop: '8px' }}>
                <div>Production Date: <strong>{trace.batch?.production_date}</strong></div>
                <div>Shift: <strong>{trace.batch?.shift}</strong></div>
                <div>Produced Quantity: <strong style={{ color: '#059669' }}>{trace.batch?.produced_qty} units</strong></div>
                <div>Scrap / Wastage: <strong style={{ color: '#DC2626' }}>{trace.batch?.wastage_qty} units</strong></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowDown size={20} color="#A8A29E" />
          </div>

          {/* STEP 3: Assigned Workers */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E7E5E4',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#F3E8FF',
              color: '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Users size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>
                STEP 3: ASSIGNED BAKERS & LINE WORKERS
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1C1917', margin: '4px 0 10px' }}>
                Personnel Sign-off Chain
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {trace.workers?.map((w, idx) => (
                  <div key={idx} style={{ padding: '10px', backgroundColor: '#FAF9F6', borderRadius: '8px', border: '1px solid #E7E5E4', fontSize: '12px' }}>
                    <strong style={{ display: 'block', color: '#1C1917' }}>{w.name} ({w.role})</strong>
                    <span style={{ color: '#78716C' }}>Task: {w.task}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowDown size={20} color="#A8A29E" />
          </div>

          {/* STEP 4: Quality Check Sign-off */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E7E5E4',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldCheck size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                  STEP 4: THERMAL & SENSORY QUALITY INSPECTION
                </span>
                <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: '4px' }}>
                  {trace.quality_check?.result || 'Not recorded'}
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1C1917', margin: '4px 0 2px' }}>
                Recorded quality inspection
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px', color: '#57534E', marginTop: '8px' }}>
                <div>Internal Core Temp: <strong>{trace.quality_check?.internal_temp}</strong></div>
                <div>Flakiness / Crumb Score: <strong>{trace.quality_check?.flakiness_score}</strong></div>
                <div>Inspected By: <strong>{trace.quality_check?.inspected_by}</strong></div>
                <div>Timestamp: <strong>{trace.quality_check?.checked_at}</strong></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowDown size={20} color="#A8A29E" />
          </div>

          {/* STEP 5: Customer Order & Dispatch */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E7E5E4',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShoppingBag size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>
                  STEP 5: CUSTOMER ORDER FULFILLMENT
                </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#C25E00', fontSize: '12px' }}>
                  {trace.customer_order?.order_reference}
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1C1917', margin: '4px 0 2px' }}>
                {trace.customer_order?.customer_name} ({trace.customer_order?.phone})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '12px', color: '#57534E', marginTop: '8px' }}>
                <div>Delivery Address: <strong>{trace.customer_order?.address}</strong></div>
                <div>Delivery Hero: <strong>{trace.customer_order?.delivery_hero}</strong></div>
                <div>Fulfillment Status: <strong style={{ color: '#059669' }}>{trace.customer_order?.order_status}</strong></div>
                <div>Total Paid: <strong>₹{trace.customer_order?.total_amount}</strong></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowDown size={20} color="#A8A29E" />
          </div>

          {/* STEP 6: Customer Feedback & Review */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid #E7E5E4',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <MessageSquare size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>
                  STEP 6: CUSTOMER SATISFACTION & VERIFIED REVIEW
                </span>
                <div style={{ display: 'flex', gap: '2px', color: '#F59E0B' }}>
                  {[...Array(trace.customer_feedback?.rating || 5)].map((_, i) => (
                    <Star key={i} size={14} fill="#F59E0B" />
                  ))}
                </div>
              </div>
              <p style={{ fontSize: '14px', fontStyle: 'italic', color: '#1C1917', margin: '8px 0' }}>
                "{trace.customer_feedback?.comment}"
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {trace.customer_feedback?.tags?.map((t, idx) => (
                  <span key={idx} style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F5F5F4', fontSize: '11px', color: '#44403C' }}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default OwnerTraceabilityPage;
