import React, { useState, useEffect } from 'react';
import staffService from '../../services/staffService';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  X
} from 'lucide-react';

const StaffIngredientsPage = () => {
  const [ingredients, setIngredients] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [modalIngredient, setModalIngredient] = useState(null);
  const [reqQuantity, setReqQuantity] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ings, reqs] = await Promise.all([
        staffService.getIngredients({ search }),
        staffService.getRequisitions()
      ]);
      setIngredients(ings || []);
      setRequisitions(reqs || []);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('crumbco:staff-refresh', handleRefresh);
    return () => window.removeEventListener('crumbco:staff-refresh', handleRefresh);
  }, [search]);

  const handleOpenRequestModal = (ingredient) => {
    setModalIngredient(ingredient);
    setReqQuantity(ingredient.required_stock ? String(ingredient.required_stock) : '10');
    setReqNotes(`Emergency floor restock for ${ingredient.name || ingredient.ingredient_name}`);
  };

  const handleSubmitRequisition = async (e) => {
    e.preventDefault();
    if (!modalIngredient) return;
    try {
      await staffService.createRequisition({
        raw_material_id: modalIngredient.id,
        requested_quantity: reqQuantity,
        unit: modalIngredient.unit,
        notes: reqNotes
      });
      setActionSuccess(`Requisition for ${reqQuantity} ${modalIngredient.unit} of ${modalIngredient.name || modalIngredient.ingredient_name} created successfully.`);
      setTimeout(() => setActionSuccess(''), 4500);
      setModalIngredient(null);
      loadData();
    } catch (err) {
      alert(`Failed to create requisition: ${err.message}`);
    }
  };

  // Group ingredients by category
  const categories = Array.from(new Set(ingredients.map(i => i.category || 'General Baking Materials')));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Title & Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#2E221D', letterSpacing: '-0.4px' }}>
            Production Ingredients Inventory
          </h1>
          <p style={{ fontSize: '14px', color: '#8E7C72', marginTop: '2px' }}>
            Real-time stock levels of raw materials at baking floor
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Search bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #EFE6DC',
            padding: '6px 12px',
            gap: '8px',
            width: '240px'
          }}>
            <Search size={16} color="#8E7C72" />
            <input
              type="text"
              placeholder="Search ingredients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', backgroundColor: 'transparent' }}
            />
          </div>

          <button
            onClick={() => handleOpenRequestModal(ingredients[0] || { id: 1, name: 'General Flour', unit: 'kg' })}
            style={{
              backgroundColor: '#D86D8B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} />
            <span>Create Requisition</span>
          </button>
        </div>
      </div>

      {/* Success banner */}
      {actionSuccess && (
        <div style={{
          backgroundColor: '#F0FDF4',
          border: '1px solid #86EFAC',
          color: '#166534',
          padding: '12px 18px',
          borderRadius: '8px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Categorized Tables */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {categories.map((cat) => {
          const items = ingredients.filter(i => (i.category || 'General Baking Materials') === cat);
          if (items.length === 0) return null;

          return (
            <div
              key={cat}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #EFE6DC',
                padding: '20px 24px',
                boxShadow: '0 2px 8px rgba(46, 34, 29, 0.04)'
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2E221D', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid #F5EFEB' }}>
                {cat}
              </h2>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: '#8E7C72', borderBottom: '1px solid #EFE6DC', fontSize: '12px' }}>
                      <th style={{ padding: '8px 0', width: '34%' }}>Ingredient Name</th>
                      <th style={{ padding: '8px 12px' }}>Today's Required</th>
                      <th style={{ padding: '8px 12px' }}>Available Stock</th>
                      <th style={{ padding: '8px 12px' }}>Physical Stock</th>
                      <th style={{ padding: '8px 12px' }}>Stock Status</th>
                      <th style={{ padding: '8px 0', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((ing) => {
                      const name = ing.name || ing.ingredient_name;
                      const availVal = Number(ing.available_stock ?? ing.current_stock ?? 0);
                      const physicalVal = Number(ing.current_stock ?? 0);
                      const status = ing.stock_status || (availVal <= 0 ? 'Out of Stock' : availVal <= Number(ing.minimum_stock ?? ing.min_reorder_level ?? 5) ? 'Low Stock' : 'Optimal');
                      const isLow = status === 'Low Stock';
                      const isOut = status === 'Out of Stock';

                      return (
                        <tr key={ing.id} style={{ borderBottom: '1px solid #FAF6F0' }}>
                          <td style={{ padding: '12px 0', fontWeight: 600, color: '#2E221D' }}>
                            {name}
                          </td>
                          <td style={{ padding: '12px 12px', color: '#5E4E45' }}>
                            {ing.required_stock || 10} {ing.unit}
                          </td>
                          <td style={{ padding: '12px 12px', fontWeight: 700, color: isOut ? '#DC2626' : isLow ? '#D97706' : '#15803D' }}>
                            {availVal.toFixed(2)} {ing.unit}
                          </td>
                          <td style={{ padding: '12px 12px', color: '#5E4E45', fontSize: '12px' }}>
                            {physicalVal.toFixed(2)} {ing.unit}
                            {Number(ing.reserved_stock) > 0 && (
                              <small style={{ display: 'block', color: '#8E7C72', fontSize: '11px' }}>
                                ({Number(ing.reserved_stock).toFixed(2)} reserved)
                              </small>
                            )}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '12px',
                              backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FEF3C7' : '#DCFCE7',
                              color: isOut ? '#DC2626' : isLow ? '#B45309' : '#15803D'
                            }}>
                              {isOut || isLow ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                              <span>{status}</span>
                            </span>
                          </td>
                          <td style={{ padding: '12px 0', textAlign: 'right' }}>
                            <button
                              onClick={() => handleOpenRequestModal(ing)}
                              style={{
                                backgroundColor: isOut || isLow ? '#D86D8B' : '#F5EFEB',
                                color: isOut || isLow ? '#FFFFFF' : '#8B5A2B',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Request Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floor Requisitions History Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #EFE6DC',
        padding: '20px 24px',
        boxShadow: '0 2px 8px rgba(46, 34, 29, 0.04)'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2E221D', marginBottom: '12px' }}>
          Active Floor Stock Requisitions
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: '#8E7C72', borderBottom: '1px solid #EFE6DC', fontSize: '12px' }}>
                <th style={{ padding: '8px 0' }}>Req #</th>
                <th style={{ padding: '8px 12px' }}>Ingredient</th>
                <th style={{ padding: '8px 12px' }}>Requested Qty</th>
                <th style={{ padding: '8px 12px' }}>Requested By</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 0' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((req) => (
                <tr key={req.id} style={{ borderBottom: '1px solid #FAF6F0' }}>
                  <td style={{ padding: '10px 0', fontWeight: 600, color: '#8B5A2B' }}>REQ-{req.id}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{req.ingredient_name}</td>
                  <td style={{ padding: '10px 12px' }}>{req.requested_quantity} {req.unit}</td>
                  <td style={{ padding: '10px 12px', color: '#5E4E45' }}>{req.baker_name}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '10px',
                      backgroundColor: req.status === 'Approved' ? '#DCFCE7' : req.status === 'Rejected' ? '#FEE2E2' : '#FEF3C7',
                      color: req.status === 'Approved' ? '#15803D' : req.status === 'Rejected' ? '#DC2626' : '#B45309'
                    }}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 0', color: '#8E7C72', fontSize: '12px' }}>{req.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Stock Modal */}
      {modalIngredient && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#2E221D' }}>
                Request {modalIngredient.name || modalIngredient.ingredient_name}
              </h3>
              <button
                onClick={() => setModalIngredient(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8E7C72' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#8E7C72', marginBottom: '16px' }}>
              Available Stock: <strong>{Number(modalIngredient.available_stock ?? modalIngredient.current_stock ?? 0).toFixed(2)} {modalIngredient.unit}</strong>
              {Number(modalIngredient.current_stock) > Number(modalIngredient.available_stock) && ` (Physical: ${Number(modalIngredient.current_stock).toFixed(2)} ${modalIngredient.unit})`}. Submit replenishment request to storekeeper.
            </p>

            <form onSubmit={handleSubmitRequisition}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                  Quantity to Dispatch ({modalIngredient.unit})
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={reqQuantity}
                  onChange={(e) => setReqQuantity(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #EFE6DC',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                  Reason / Floor Notes
                </label>
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #EFE6DC',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalIngredient(null)}
                  style={{
                    backgroundColor: '#F5EFEB',
                    color: '#5E4E45',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#D86D8B',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
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

export default StaffIngredientsPage;
