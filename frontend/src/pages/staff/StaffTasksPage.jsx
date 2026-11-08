import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import staffService from '../../services/staffService';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Flame,
  Package,
  Layers,
  Check,
  X,
  RefreshCw,
  Plus,
  BookOpen,
  ShoppingBag,
  Filter,
  User,
  ShieldAlert
} from 'lucide-react';
import { PageHeader, RefreshButton, MetricStrip } from '../../components/owner/OwnerUI';
import '../../styles/owner-workspace.css';

const StaffTasksPage = () => {
  const navigate = useNavigate();
  const { user, getServerTime } = useAuth();

  const [batches, setBatches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL' | 'ORDERS' | 'BATCHES'
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Requisition modal for shortages
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [reqIngredientId, setReqIngredientId] = useState('');
  const [reqQuantity, setReqQuantity] = useState('10');
  const [reqNotes, setReqNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [batchRes, orderRes, ingRes] = await Promise.all([
        staffService.getBatches().catch(() => []),
        staffService.getAllOrders().catch(() => ({ data: [] })),
        staffService.getIngredients().catch(() => [])
      ]);

      const bList = Array.isArray(batchRes) ? batchRes : batchRes?.data || [];
      const oList = Array.isArray(orderRes) ? orderRes : orderRes?.data || [];
      const iList = Array.isArray(ingRes) ? ingRes : ingRes?.data || [];

      setBatches(bList);
      setOrders(oList);
      setIngredients(iList);

      if (iList.length > 0 && !reqIngredientId) {
        setReqIngredientId(String(iList[0].id));
      }
    } catch (err) {
      console.error('Error loading tasks data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('crumbco:staff-refresh', handleRefresh);
    return () => window.removeEventListener('crumbco:staff-refresh', handleRefresh);
  }, []);

  const handleCreateRequisition = async (e) => {
    e.preventDefault();
    try {
      await staffService.createRequisition({
        raw_material_id: reqIngredientId,
        requested_quantity: reqQuantity,
        notes: reqNotes || 'Floor stock replenishment requested by baker'
      });
      setShowRequisitionModal(false);
      setActionSuccess(`Replenishment request for ${reqQuantity} units submitted for owner review.`);
      setTimeout(() => setActionSuccess(''), 4500);
      setReqNotes('');
    } catch (err) {
      alert(`Failed to submit replenishment request: ${err.message}`);
    }
  };

  // Identify Genuine Ingredient Shortages (Consistent calculation)
  const shortages = ingredients.filter(ing => {
    if (ing.stock_status) return ing.stock_status === 'Low Stock' || ing.stock_status === 'Out of Stock';
    const avail = parseFloat(ing.available_stock ?? ing.current_stock ?? 0);
    const thresh = parseFloat(ing.minimum_stock ?? ing.min_reorder_level ?? 0);
    return avail <= thresh;
  });

  // Map Orders to unified task model (Strictly Active & Today's floor orders)
  const orderTasks = orders
    .filter(ord => {
      const rawStatus = (ord.order_status || ord.status || '').trim();
      const pStatus = (ord.payment_status || '').trim();
      if (rawStatus === 'Rejected' || pStatus === 'Rejected' || rawStatus === 'Cancelled') return false;
      if (rawStatus === 'Order Placed' || pStatus === 'Pending Verification') return false;
      if (ord.is_ready_for_baker === false) return false;

      // Auto-remove completed work on next day
      const isCompleted = ['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered', 'READY FOR DISPATCH', 'Dispatched'].includes(rawStatus);
      if (isCompleted) {
        const compTimestamp = ord.updated_at || ord.completed_at || ord.delivery_date || ord.created_at;
        if (compTimestamp) {
          const compDate = new Date(String(compTimestamp).replace(' ', 'T'));
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (compDate < todayStart) {
            return false; // Auto-removed on next day!
          }
        }
      }
      return true;
    })
    .map(ord => {
      const rawStatus = (ord.order_status || ord.status || 'Accepted').trim();
      let stage = 'Pending';
      if (['Accepted', 'Preparation', 'Proofing'].includes(rawStatus)) {
        stage = 'Pending';
      } else if (['Baking', 'In Production', 'Cooling', 'Product Completed'].includes(rawStatus)) {
        stage = 'In Progress';
      } else if (['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered', 'READY FOR DISPATCH', 'Dispatched'].includes(rawStatus)) {
        stage = 'Completed';
      }

      const displayStage = ['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed'].includes(rawStatus)
        ? 'Product Completed & Packed'
        : rawStatus;

      const items = ord.items || [];
      const firstItem = items[0] || {};
      const totalQty = items.length > 0
        ? items.reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 1), 0)
        : (parseInt(ord.quantity, 10) || parseInt(ord.total_units, 10) || 1);

      return {
        id: `ord-${ord.id}`,
        type: 'ORDER',
        taskType: 'customer_order',
        isInternal: false,
        customerName: ord.customer_name || ord.guest_name || 'Customer Order',
        rawId: ord.id,
        orderNo: ord.order_no || ord.id,
        productName: items.length > 1
          ? `${firstItem.product_name || firstItem.name || 'Artisanal Baked Item'} + ${items.length - 1} more`
          : (firstItem.product_name || firstItem.name || 'Artisanal Baked Item'),
        quantity: totalQty,
        priority: ord.table_tag ? 'Urgent' : totalQty > 10 ? 'High' : 'Normal',
        dueTime: ord.delivery_time_slot || ord.estimated_delivery_time || 'Planned Batch',
        stage: displayStage,
        statusCategory: stage,
        assignedBaker: ord.assigned_baker || user?.name || 'Baker',
        raw: ord
      };
    });

  // Map Batches to unified task model (Strictly Active Batches)
  const batchTasks = batches
    .filter(batch => {
      const rawStatus = (batch.status || '').trim();
      if (rawStatus === 'Rejected' || rawStatus === 'Cancelled') return false;

      // Auto-remove completed batches on next day
      const isCompleted = ['Completed', 'Packaged'].includes(rawStatus);
      if (isCompleted) {
        const compTimestamp = batch.updated_at || batch.completed_at || batch.created_at;
        if (compTimestamp) {
          const compDate = new Date(String(compTimestamp).replace(' ', 'T'));
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (compDate < todayStart) {
            return false; // Auto-removed on next day!
          }
        }
      }
      return true;
    })
    .map(batch => {
      const rawStatus = (batch.status || 'Planned').trim();
      let stage = 'Pending';
      if (['Planned', 'Accepted', 'Preparation', 'Proofing'].includes(rawStatus)) {
        stage = 'Pending';
      } else if (['In Production', 'Baking', 'Cooling', 'Product Completed'].includes(rawStatus)) {
        stage = 'In Progress';
      } else if (['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Dispatched'].includes(rawStatus)) {
        stage = 'Completed';
      }

      const displayStage = ['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed'].includes(rawStatus)
        ? 'Product Completed & Packed'
        : rawStatus;

      const isInternal = Boolean(batch.is_internal_production || !batch.customer_name);
      return {
        id: `batch-${batch.id}`,
        type: 'BATCH',
        taskType: batch.task_type || (isInternal ? 'batch_production' : 'customer_order'),
        isInternal,
        customerName: isInternal ? null : (batch.customer_name || null),
        rawId: batch.id,
        orderNo: batch.batch_no || batch.batch_code || `B-${batch.id}`,
        productName: batch.product_name || 'Production Batch Item',
        quantity: batch.planned_quantity || 12,
        priority: (batch.planned_quantity > 25) ? 'High' : 'Normal',
        dueTime: batch.scheduled_start || '06:00 AM Shift',
        stage: displayStage,
        statusCategory: stage,
        assignedBaker: batch.assigned_baker || user?.name || 'Baker',
        raw: batch
      };
    });

  // Combine tasks
  const allTasks = [...orderTasks, ...batchTasks];

  // Apply Filters
  const filteredTasks = allTasks.filter(task => {
    // Status filter
    if (statusFilter === 'PENDING' && task.statusCategory !== 'Pending') return false;
    if (statusFilter === 'IN_PROGRESS' && task.statusCategory !== 'In Progress') return false;
    if (statusFilter === 'COMPLETED' && task.statusCategory !== 'Completed') return false;

    // Source filter
    if (sourceFilter === 'ORDERS' && task.type !== 'ORDER') return false;
    if (sourceFilter === 'BATCHES' && task.type !== 'BATCH') return false;

    // Only my tasks
    if (onlyMyTasks && user?.name && !task.assignedBaker.toLowerCase().includes(user.name.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Shift concept removed - clean status badge
  const getTaskShiftBadge = (task) => {
    if (task.statusCategory === 'Completed') {
      return { label: 'Completed', color: '#059669', bg: '#ECFDF5' };
    }
    return { label: 'Scheduled', color: '#8B5A2B', bg: '#FAF6F0' };
  };

  // Metrics
  const pendingCount = allTasks.filter(t => t.statusCategory === 'Pending').length;
  const inProgressCount = allTasks.filter(t => t.statusCategory === 'In Progress').length;
  const completedCount = allTasks.filter(t => t.statusCategory === 'Completed').length;
  const urgentCount = allTasks.filter(t => t.priority === 'Urgent').length;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Toast Notification */}
      {actionSuccess && (
        <div style={{
          backgroundColor: '#F0FDF4',
          border: '1px solid #86EFAC',
          color: '#166534',
          padding: '12px 18px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Module 1 Top Header — matches Wastage & Buffer and Order Recipes sections (Owner UI Design System) */}
      <PageHeader
        eyebrow={`Kitchen Shift Operations · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        title="Today's Task Schedule"
        description={`Station: Baking & Prep Floor · Baker: ${user?.name || 'Baker'}`}
      >
        <RefreshButton onClick={loadData} loading={isLoading} />
      </PageHeader>

      {/* Task Metric Strip — Owner UI Design System */}
      <MetricStrip items={[
        {
          icon: ShoppingBag,
          label: 'Total Tasks',
          value: allTasks.length,
          note: 'Orders & batches on floor today'
        },
        {
          icon: AlertTriangle,
          label: 'Urgent',
          value: urgentCount,
          note: 'Priority tasks requiring attention'
        },
        {
          icon: Flame,
          label: 'In Progress',
          value: inProgressCount,
          note: 'Currently being prepared'
        },
        {
          icon: CheckCircle2,
          label: 'Completed',
          value: completedCount,
          note: 'Finished this shift'
        }
      ]} />

      {/* Genuine Ingredient Shortage Warning Banner */}
      {shortages.length > 0 && (
        <div style={{
          backgroundColor: '#F9F0DF',
          borderRadius: '10px',
          border: '1px solid rgba(154, 100, 42, 0.35)',
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(154, 100, 42, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#FFF8E7',
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
                Floor Stock Alert ({shortages.length} ingredient{shortages.length > 1 ? 's' : ''} at/below minimum threshold)
              </div>
              <div style={{ fontSize: '12px', color: '#9A642A', marginTop: '2px' }}>
                {shortages.map(s => `${s.name} (${Number(s.available_stock ?? s.current_stock ?? 0).toFixed(2)} ${s.unit} left, reorder at ${Number(s.minimum_stock ?? s.min_reorder_level ?? 0).toFixed(2)} ${s.unit})`).join(' • ')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRequisitionModal(true)}
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
              gap: '6px',
              transition: 'background 0.15s ease'
            }}
          >
            <Plus size={14} />
            <span>Request Restock from Owner</span>
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '14px 20px',
        border: '1px solid #EFE6DC',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Status Filter Pills: All, Pending, In Progress, Completed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#8E7C72', textTransform: 'uppercase' }}>Filter:</span>
          {[
            { id: 'ALL', label: `All (${allTasks.length})` },
            { id: 'PENDING', label: `Pending (${pendingCount})` },
            { id: 'IN_PROGRESS', label: `In Progress (${inProgressCount})` },
            { id: 'COMPLETED', label: `Completed (${completedCount})` }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: statusFilter === f.id ? '2px solid #8B5A2B' : '1px solid #EFE6DC',
                backgroundColor: statusFilter === f.id ? '#8B5A2B' : '#FAF6F0',
                color: statusFilter === f.id ? '#FFFFFF' : '#5E4E45'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Source Filter and My Tasks Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #EFE6DC',
              fontSize: '13px',
              color: '#5E4E45',
              backgroundColor: '#FFFFFF'
            }}
          >
            <option value="ALL">All Sources ({allTasks.length})</option>
            <option value="ORDERS">Customer Orders Only ({orderTasks.length})</option>
            <option value="BATCHES">Production Batches Only ({batchTasks.length})</option>
          </select>

          <button
            type="button"
            onClick={loadData}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #EFE6DC',
              backgroundColor: '#FFFFFF',
              color: '#8B5A2B',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Task Cards Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredTasks.length === 0 ? (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px dashed #E8DFD5',
            padding: '50px 24px',
            textAlign: 'center',
            color: '#8E7C72'
          }}>
            <ShoppingBag size={32} style={{ margin: '0 auto 10px', color: '#8B5A2B' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#2E221D', marginBottom: '4px' }}>
              No tasks match the active filters
            </div>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Try selecting "All" or refresh to inspect newly accepted orders from the owner portal.
            </p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const isCompleted = task.statusCategory === 'Completed';
            const isInProgress = task.statusCategory === 'In Progress';
            const isUrgent = task.priority === 'Urgent';

            return (
              <div
                key={task.id}
                onClick={() => {
                  if (task.type === 'ORDER') {
                    navigate(`/staff/production?orderId=${task.rawId}`);
                  } else {
                    navigate(`/staff/production?batchId=${task.rawId}`);
                  }
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: isCompleted
                    ? '1.5px solid #BBF7D0'
                    : isUrgent
                    ? '1.5px solid #FCA5A5'
                    : isInProgress
                    ? '1.5px solid #FCD34D'
                    : '1px solid #EFE6DC',
                  padding: '18px 22px',
                  boxShadow: '0 2px 6px rgba(46, 34, 29, 0.04)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Left Task Identity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '260px', flex: '1 1 300px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: task.type === 'ORDER' ? '#FEF3C7' : '#EFF6FF',
                    color: task.type === 'ORDER' ? '#B45309' : '#1D4ED8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {task.type === 'ORDER' ? <ShoppingBag size={20} /> : <Layers size={20} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#2E221D' }}>
                        {task.productName}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#FAF6F0',
                        color: '#8B5A2B',
                        border: '1px solid #EFE6DC',
                        fontFamily: 'monospace'
                      }}>
                        {task.type === 'ORDER' ? `Order #${task.orderNo}` : `Batch #${task.orderNo}`}
                      </span>
                      {task.type === 'ORDER' ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
                          Customer Order
                        </span>
                      ) : task.isInternal ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' }}>
                          Internal Production
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #93C5FD' }}>
                          Order Demand Batch
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: '#8E7C72', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span>Required: <strong style={{ color: '#2E221D' }}>{task.quantity} units</strong></span>
                      <span>•</span>
                      <span>Due: <strong style={{ color: '#2E221D' }}>{task.dueTime}</strong></span>
                      <span>•</span>
                      <span>Baker: <strong style={{ color: '#8B5A2B' }}>{task.assignedBaker}</strong></span>
                      {task.customerName ? (
                        <>
                          <span>•</span>
                          <span>Customer: <strong style={{ color: '#2E221D' }}>{task.customerName}</strong></span>
                        </>
                      ) : (
                        <>
                          <span>•</span>
                          <span style={{ fontStyle: 'italic', color: '#64748B' }}>Storefront / Buffer Stock</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center Status Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {isUrgent && (
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      fontWeight: 800,
                      fontSize: '11px',
                      border: '1px solid #FCA5A5'
                    }}>
                      ⚡ URGENT
                    </span>
                  )}

                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: isCompleted ? '#DCFCE7' : isInProgress ? '#FEF3C7' : '#F5EFEB',
                    color: isCompleted ? '#15803D' : isInProgress ? '#B45309' : '#5E4E45'
                  }}>
                    Stage: {task.stage}
                  </span>

                  {/* Task Shift Window Label (Due In-Shift / Overdue) */}
                  {(() => {
                    const badge = getTaskShiftBadge(task);
                    return (
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Clock size={11} />
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Right Call to Action */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (task.type === 'ORDER') {
                      navigate(`/staff/production?orderId=${task.rawId}`);
                    } else {
                      navigate(`/staff/production?batchId=${task.rawId}`);
                    }
                  }}
                  style={{
                    backgroundColor: '#8B5A2B',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(139, 90, 43, 0.2)'
                  }}
                >
                  <span>Open Production Station</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Floor Stock Replenishment Request Modal */}
      {showRequisitionModal && (
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
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} color="#D97706" />
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#2E221D', margin: 0 }}>
                  Request Ingredient Replenishment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRequisitionModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8E7C72' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#8E7C72', margin: 0 }}>
              Submit a stock requisition for owner or inventory supervisor approval. Bakers cannot silently override stock balances.
            </p>

            <form onSubmit={handleCreateRequisition} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                  Raw Material / Ingredient
                </label>
                <select
                  value={reqIngredientId}
                  onChange={(e) => setReqIngredientId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #EFE6DC',
                    fontSize: '13px',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Available: {Number(ing.available_stock ?? ing.current_stock ?? 0).toFixed(2)} {ing.unit}{Number(ing.current_stock) > Number(ing.available_stock) ? `, Physical: ${Number(ing.current_stock).toFixed(2)} ${ing.unit}` : ''}, Min: {Number(ing.minimum_stock ?? ing.min_reorder_level ?? 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5E4E45', marginBottom: '4px' }}>
                  Requested Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={reqQuantity}
                  onChange={(e) => setReqQuantity(e.target.value)}
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
                  Urgency / Shift Notes
                </label>
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="e.g. Morning bake shift requires 10kg butter for sourdough and croissant batches."
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowRequisitionModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #EFE6DC',
                    backgroundColor: '#FAF6F0',
                    color: '#5E4E45',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#D97706',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Submit for Owner Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffTasksPage;
