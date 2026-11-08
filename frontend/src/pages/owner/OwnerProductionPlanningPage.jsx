import React, { useState, useEffect } from 'react';
import ownerService from '../../services/ownerService';
import staffService from '../../services/staffService';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Layers,
  ChefHat,
  Scale,
  Sparkles,
  RefreshCw,
  Plus,
  X,
  Package,
  Calendar
} from 'lucide-react';

const OwnerProductionPlanningPage = () => {
  const [planningData, setPlanningData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // New Custom Planned Batch Modal State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [productsList, setProductsList] = useState([]);
  const [customPlanForm, setCustomPlanForm] = useState({
    product_id: '',
    batch_no: `PLN-${Date.now().toString().slice(-4)}`,
    planned_quantity: 20,
    planned_weight: '',
    planned_weight_unit: 'kg',
    shift: 'Morning Shift (05:00 AM - 01:00 PM)',
    baker_name: 'Rajesh Kumar (Baker)',
    scheduled_start: '06:00 AM',
    notes: 'Forecasted floor buffer for anticipated walk-in demand'
  });

  const loadPlanning = async () => {
    try {
      setLoading(true);
      const [planRes, prodRes] = await Promise.all([
        ownerService.getProductionPlanning(),
        ownerService.getProducts().catch(() => [])
      ]);
      setPlanningData(planRes.data || planRes || null);
      const prods = Array.isArray(prodRes?.data) ? prodRes.data : (Array.isArray(prodRes) ? prodRes : []);
      setProductsList(prods);
      if (prods.length > 0 && !customPlanForm.product_id) {
        setCustomPlanForm(prev => ({ ...prev, product_id: prods[0].id }));
      }
    } catch (err) {
      console.error('Failed to load production planning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlanning();
  }, []);

  const handleGenerateBatch = async (plan) => {
    try {
      setGenerating(true);
      const batchNo = `BC-${Date.now().toString().slice(-4)}`;
      // Planned batches must NEVER have fake orders or arbitrary customer names!
      await staffService.createBatch({
        batch_no: batchNo,
        product_id: plan.product_id,
        product_name: plan.product_name,
        planned_quantity: plan.net_production_required,
        priority: 'Normal',
        shift: plan.shift || 'Morning Shift',
        source_orders: (plan.order_ids && plan.order_ids.length > 0) ? plan.order_ids : [],
        is_planned: (plan.order_ids && plan.order_ids.length > 0) ? 0 : 1
      });

      setSuccessMsg(`Generated planned production batch #${batchNo} for ${plan.product_name} (${plan.net_production_required} units)! Dispatched to Baker's schedule.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadPlanning();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to generate batch');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateCustomPlannedBatch = async (e) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const chosenProd = productsList.find(p => String(p.id) === String(customPlanForm.product_id));
      await staffService.createBatch({
        batch_no: customPlanForm.batch_no || `PLN-${Date.now().toString().slice(-4)}`,
        product_id: Number(customPlanForm.product_id),
        product_name: chosenProd?.name || 'Artisanal Baked Item',
        planned_quantity: Number(customPlanForm.planned_quantity),
        planned_weight: customPlanForm.planned_weight ? Number(customPlanForm.planned_weight) : null,
        planned_weight_unit: customPlanForm.planned_weight_unit,
        priority: 'Normal',
        shift: customPlanForm.shift,
        scheduled_start: customPlanForm.scheduled_start,
        source_orders: [], // Explicitly empty: forecast/inventory preparation batch
        is_planned: 1
      });

      setShowPlanModal(false);
      setSuccessMsg(`Successfully created forecasted production batch #${customPlanForm.batch_no}!`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setCustomPlanForm({
        product_id: productsList[0]?.id || '',
        batch_no: `PLN-${Date.now().toString().slice(-4)}`,
        planned_quantity: 20,
        planned_weight: '',
        planned_weight_unit: 'kg',
        shift: 'Morning Shift (05:00 AM - 01:00 PM)',
        baker_name: 'Rajesh Kumar (Baker)',
        scheduled_start: '06:00 AM',
        notes: 'Forecasted floor buffer for anticipated walk-in demand'
      });
      await loadPlanning();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create planned batch');
    } finally {
      setGenerating(false);
    }
  };

  const defaultPlans = [
    {
      product_id: 1,
      product_name: 'Country Sourdough Loaf',
      confirmed_demand: 0,
      finished_stock: 12,
      net_production_required: 20,
      bakers_percentage_flour: '15.0 kg Flour',
      flour_available: '185.0 kg on Floor',
      baker_assigned: 'Rajesh Kumar (Baker)',
      shift: 'Morning (05:00 AM - 01:00 PM)',
      status: 'FEASIBLE',
      order_ids: [],
      is_forecast: true
    },
    {
      product_id: 2,
      product_name: 'Almond Twice-Baked Croissant',
      confirmed_demand: 0,
      finished_stock: 8,
      net_production_required: 24,
      bakers_percentage_flour: '12.5 kg Flour & Butter',
      flour_available: '185.0 kg on Floor',
      baker_assigned: 'Rajesh Kumar (Baker)',
      shift: 'Morning (05:00 AM - 01:00 PM)',
      status: 'FEASIBLE',
      order_ids: [],
      is_forecast: true
    },
    {
      product_id: 3,
      product_name: 'Dark Chocolate Babka',
      confirmed_demand: 0,
      finished_stock: 4,
      net_production_required: 15,
      bakers_percentage_flour: '8.0 kg Chocolate Dough',
      flour_available: '15.0 kg Chocolate Dough Available',
      baker_assigned: 'Priya Sharma (Head Pâtissier)',
      shift: 'Afternoon (01:00 PM - 09:00 PM)',
      status: 'FEASIBLE',
      order_ids: [],
      is_forecast: true
    }
  ];

  const plans = (planningData && planningData.plans && planningData.plans.length > 0)
    ? planningData.plans
    : defaultPlans;

  const plannedBatches = (planningData && planningData.planned_batches) || [];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Alert */}
      {successMsg && (
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
          <span>{successMsg}</span>
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
              <CalendarCheck size={20} />
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              Production Planning & Material Feasibility Engine
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#78716C', margin: '6px 0 0 44px' }}>
            Forecast and schedule bakery batches for anticipated demand, floor inventory buffer, and confirmed customer orders.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowPlanModal(true)}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              backgroundColor: '#C25E00',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(194, 94, 0, 0.2)'
            }}
          >
            <Plus size={16} />
            <span>Plan New Batch</span>
          </button>

          <button
            onClick={loadPlanning}
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
            <span>Recalculate Demand</span>
          </button>
        </div>
      </div>

      {/* Section 1: Forecast & Demand Feasibility Cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <ChefHat size={18} color="#C25E00" />
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#1C1917', margin: 0 }}>
            Anticipated Demand & Material Feasibility
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {plans.map((p, idx) => {
            const isFeasible = p.status === 'FEASIBLE';

            return (
              <div
                key={idx}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '24px',
                  border: isFeasible ? '1px solid #E7E5E4' : '1px solid #FCA5A5',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
                      {p.product_name}
                    </h3>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: isFeasible ? '#DCFCE7' : '#FEE2E2',
                      color: isFeasible ? '#15803D' : '#991B1B'
                    }}>
                      {isFeasible ? 'FEASIBLE' : 'SHORTAGE ALERT'}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: '#78716C', margin: '0 0 16px' }}>
                    {p.order_ids && p.order_ids.length > 0 ? (
                      <>Demand from orders: <strong>{p.order_ids.join(', ')}</strong></>
                    ) : (
                      <span style={{ color: '#0369A1', backgroundColor: '#E0F2FE', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        Forecasted Inventory / Showcase Buffer (No Customer Orders)
                      </span>
                    )}
                  </p>

                  {/* Math breakdown */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    backgroundColor: '#FAF9F6',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #E7E5E4',
                    textAlign: 'center',
                    marginBottom: '16px'
                  }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#78716C', textTransform: 'uppercase', fontWeight: 600 }}>Confirmed Demand</span>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#1C1917' }}>{p.confirmed_demand || 0} pcs</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#78716C', textTransform: 'uppercase', fontWeight: 600 }}>Finished Stock</span>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#78716C' }}>-{p.finished_stock || 0} pcs</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#C25E00', textTransform: 'uppercase', fontWeight: 600 }}>Net Bake Target</span>
                      <strong style={{ display: 'block', fontSize: '16px', color: '#C25E00' }}>={p.net_production_required} pcs</strong>
                    </div>
                  </div>

                  {/* Material & Baker Requirements */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#57534E' }}>
                      <span>Key Material Needed:</span>
                      <strong style={{ color: isFeasible ? '#1C1917' : '#DC2626' }}>{p.bakers_percentage_flour}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#57534E' }}>
                      <span>Stock on Floor:</span>
                      <strong style={{ color: isFeasible ? '#059669' : '#DC2626' }}>{p.flour_available}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#57534E' }}>
                      <span>Assigned Baker:</span>
                      <strong>{p.baker_assigned}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#57534E' }}>
                      <span>Floor Shift:</span>
                      <span>{p.shift}</span>
                    </div>
                  </div>
                </div>

                {/* Action: Generate Batch */}
                <div style={{ borderTop: '1px solid #F5F5F4', paddingTop: '14px' }}>
                  <button
                    onClick={() => handleGenerateBatch(p)}
                    disabled={generating}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      backgroundColor: isFeasible ? '#C25E00' : '#D97706',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(194, 94, 0, 0.2)'
                    }}
                  >
                    <Plus size={16} />
                    <span>Generate Planned Batch ({p.net_production_required} units)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Active Planned Batches (Database Driven) */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E7E5E4', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#C25E00" />
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#1C1917', margin: 0 }}>
              Active Planned Production Batches (Database Schedule)
            </h2>
          </div>
          <span style={{ fontSize: '12px', color: '#78716C', fontWeight: 600 }}>
            {plannedBatches.length} planned batch(es) awaiting bake execution
          </span>
        </div>

        {plannedBatches.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#78716C', backgroundColor: '#FAF9F6', borderRadius: '12px', border: '1px dashed #D6D3D1' }}>
            <Package size={28} style={{ margin: '0 auto 8px', color: '#A8A29E' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No planned batches pending execution.</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Use "Plan New Batch" above to schedule upcoming production.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#FAF9F6', borderBottom: '1px solid #E7E5E4', textAlign: 'left', color: '#78716C' }}>
                  <th style={{ padding: '10px 14px' }}>Planned Batch ID</th>
                  <th style={{ padding: '10px 14px' }}>Product</th>
                  <th style={{ padding: '10px 14px' }}>Planned Target</th>
                  <th style={{ padding: '10px 14px' }}>Assigned Baker</th>
                  <th style={{ padding: '10px 14px' }}>Customer Linking Status</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {plannedBatches.map(pb => (
                  <tr key={pb.id} style={{ borderBottom: '1px solid #F5F5F4' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '12px', backgroundColor: '#FEF3C7', color: '#B45309', padding: '3px 8px', borderRadius: '4px' }}>
                        {pb.batch_no || pb.batch_code || `PLN-${pb.id}`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <strong style={{ color: '#1C1917' }}>{pb.product_name}</strong>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <strong>{pb.planned_quantity} pcs</strong>
                      {pb.planned_weight && (
                        <span style={{ display: 'block', fontSize: '11px', color: '#78716C' }}>
                          Target: {pb.planned_weight} {pb.planned_weight_unit || 'g'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#44403C' }}>
                      {pb.baker_name || 'Rajesh Kumar (Baker)'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600, border: '1px solid #E2E8F0' }}>
                        Inventory Buffer (No Customer Orders Linked)
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        {pb.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: PLAN NEW BATCH FOR ANTICIPATED DEMAND */}
      {showPlanModal && (
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
            maxWidth: '560px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E7E5E4', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={20} color="#C25E00" />
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#1C1917' }}>
                  Plan New Production Batch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#78716C' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#78716C' }}>
              Planned production batches prepare inventory for anticipated future demand. They are completely independent of customer orders and will not display customer names until actual orders are allocated.
            </p>

            <form onSubmit={handleCreateCustomPlannedBatch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Product *
                </label>
                <select
                  required
                  value={customPlanForm.product_id}
                  onChange={(e) => setCustomPlanForm(prev => ({ ...prev, product_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px' }}
                >
                  {productsList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Planned Batch Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={customPlanForm.batch_no}
                    onChange={(e) => setCustomPlanForm(prev => ({ ...prev, batch_no: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Planned Pieces / Units *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={customPlanForm.planned_quantity}
                    onChange={(e) => setCustomPlanForm(prev => ({ ...prev, planned_quantity: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Planned Weight (Optional for weight-based)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1500 or 1.5"
                    value={customPlanForm.planned_weight}
                    onChange={(e) => setCustomPlanForm(prev => ({ ...prev, planned_weight: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Unit
                  </label>
                  <select
                    value={customPlanForm.planned_weight_unit}
                    onChange={(e) => setCustomPlanForm(prev => ({ ...prev, planned_weight_unit: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px' }}
                  >
                    <option value="g">grams (g)</option>
                    <option value="kg">kilograms (kg)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Assigned Baker
                  </label>
                  <input
                    type="text"
                    value={customPlanForm.baker_name}
                    onChange={(e) => setCustomPlanForm(prev => ({ ...prev, baker_name: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Shift
                  </label>
                  <select
                    value={customPlanForm.shift}
                    onChange={(e) => setCustomPlanForm(prev => ({ ...prev, shift: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px' }}
                  >
                    <option value="Morning Shift (05:00 AM - 01:00 PM)">Morning Shift (05:00 AM - 01:00 PM)</option>
                    <option value="Afternoon Shift (01:00 PM - 09:00 PM)">Afternoon Shift (01:00 PM - 09:00 PM)</option>
                    <option value="Night Prep Shift (09:00 PM - 05:00 AM)">Night Prep Shift (09:00 PM - 05:00 AM)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D6D3D1', background: '#FAFAF9', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  style={{ padding: '8px 18px', borderRadius: '8px', backgroundColor: '#C25E00', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {generating ? 'Scheduling...' : 'Confirm Planned Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerProductionPlanningPage;
