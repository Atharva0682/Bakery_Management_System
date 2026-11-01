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
  Plus
} from 'lucide-react';

const OwnerProductionPlanningPage = () => {
  const [planningData, setPlanningData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadPlanning = async () => {
    try {
      setLoading(true);
      const res = await ownerService.getProductionPlanning();
      setPlanningData(res.data || res || null);
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
      await staffService.createBatch({
        batch_no: batchNo,
        product_id: plan.product_id,
        product_name: plan.product_name,
        planned_quantity: plan.net_production_required,
        priority: 'Normal',
        shift: 'Morning Shift',
        source_orders: plan.order_ids || ['#CC-4112']
      });

      setSuccessMsg(`Generated production batch #${batchNo} for ${plan.product_name} (${plan.net_production_required} units)! Staged to Baker's Tasks.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadPlanning();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to generate batch');
    } finally {
      setGenerating(false);
    }
  };

  const defaultPlans = [
    {
      product_id: 1,
      product_name: 'Country Sourdough Loaf',
      confirmed_demand: 120,
      finished_stock: 30,
      net_production_required: 90,
      bakers_percentage_flour: '45.0 kg',
      flour_available: '185.0 kg',
      baker_assigned: 'Rajesh Kumar (Baker)',
      shift: 'Morning (05:00 AM - 01:00 PM)',
      status: 'FEASIBLE',
      order_ids: ['#CC-4112', '#CC-4115']
    },
    {
      product_id: 2,
      product_name: 'Almond Twice-Baked Croissant',
      confirmed_demand: 80,
      finished_stock: 15,
      net_production_required: 65,
      bakers_percentage_flour: '22.5 kg',
      flour_available: '185.0 kg',
      baker_assigned: 'Rajesh Kumar (Baker)',
      shift: 'Morning (05:00 AM - 01:00 PM)',
      status: 'FEASIBLE',
      order_ids: ['#CC-4113']
    },
    {
      product_id: 3,
      product_name: 'Dark Chocolate Babka',
      confirmed_demand: 45,
      finished_stock: 5,
      net_production_required: 40,
      bakers_percentage_flour: '15.0 kg',
      flour_available: '1.2 kg Cocoa Powder (Shortage!)',
      baker_assigned: 'Priya Sharma (Head Pâtissier)',
      shift: 'Afternoon (01:00 PM - 09:00 PM)',
      status: 'SHORTAGE_WARNING',
      order_ids: ['#CC-4118']
    }
  ];

  const plans = (planningData && planningData.plans) || defaultPlans;

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
            Calculate net batch production requirements from confirmed customer orders, BOM recipes, and floor stock feasibility.
          </p>
        </div>

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

      {/* Production Planning Logic Cards */}
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
                  Demand from orders: <strong>{p.order_ids.join(', ')}</strong>
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
                    <strong style={{ display: 'block', fontSize: '16px', color: '#1C1917' }}>{p.confirmed_demand} pcs</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#78716C', textTransform: 'uppercase', fontWeight: 600 }}>Finished Stock</span>
                    <strong style={{ display: 'block', fontSize: '16px', color: '#78716C' }}>-{p.finished_stock} pcs</strong>
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
                  <span>Generate Production Batch ({p.net_production_required} units)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OwnerProductionPlanningPage;
