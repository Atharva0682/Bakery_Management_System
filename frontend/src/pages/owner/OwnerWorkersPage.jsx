import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  Search,
  Pencil,
  Mail,
  Phone,
  Clock3,
  ChefHat,
  Shield,
  PackageCheck,
  ArrowUpRight,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Calendar,
  XCircle
} from 'lucide-react';
import ownerService from '../../services/ownerService';
import usePolling from '../../hooks/usePolling';
import {
  PageHeader,
  MetricStrip,
  Dialog,
  Notice,
  EmptyState,
  StatusBadge,
  RefreshButton,
  money,
  unwrap
} from '../../components/owner/OwnerUI';
import '../../styles/owner-settings.css';
import '../../styles/owner-workspace.css';

const roles = {
  baker: 'Artisanal Deck Baker',
  staff: 'Packaging & Dispatch Staff',
  manager: 'Kitchen & Operations Manager'
};

const shortRoles = {
  baker: 'Baker',
  staff: 'Staff',
  manager: 'Manager'
};

const initials = name =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

const roleOf = worker => {
  if (!worker) return 'baker';
  if (worker.raw_role) return worker.raw_role;
  const str = String(worker.role || '').toLowerCase();
  if (str.includes('manager')) return 'manager';
  if (str.includes('staff')) return 'staff';
  return 'baker';
};

const hasBatch = worker =>
  worker.active_batch &&
  !['Floor Operations Standby', 'Floor Supervision', 'No active batch assignment'].includes(worker.active_batch);

export default function OwnerWorkersPage() {
  const { data, loading, error, refresh, lastUpdatedLabel } = usePolling(async () => {
    const result = unwrap(await ownerService.getWorkers());
    return Array.isArray(result) ? result : result?.workers || [];
  }, 30000);

  const workers = data || [];

  // Filter & Search states
  const [scopeTab, setScopeTab] = useState('ACTIVE'); // 'ACTIVE', 'DISMISSED', 'ALL'
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [floorOnly, setFloorOnly] = useState(false);

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [dismissTarget, setDismissTarget] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);

  // Form states for Add Worker
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'baker',
    daily_wage: '1000',
    password: '',
    confirm_password: ''
  });
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showAddConfirmPassword, setShowAddConfirmPassword] = useState(false);

  // Form states for Edit Worker
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'baker',
    daily_wage: '',
    new_password: '',
    confirm_password: ''
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  // Dismiss reason state
  const [dismissReason, setDismissReason] = useState('');

  // Async action feedback
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [bannerNotice, setBannerNotice] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  // Categorize staff
  const activeStaff = workers.filter(w => Boolean(w.is_active));
  const dismissedStaff = workers.filter(w => !w.is_active);
  const floorStaff = activeStaff.filter(w => w.is_on_floor || w.status === 'On Floor');
  const activeBakers = activeStaff.filter(w => roleOf(w) === 'baker');
  const activeManagers = activeStaff.filter(w => roleOf(w) === 'manager');
  const totalActiveWage = activeStaff.reduce((sum, w) => sum + Number(w.daily_wage || 0), 0);

  // Filtered list based on Scope, Search, Role, and Floor
  const filteredWorkers = workers.filter(person => {
    // 1. Scope tab
    if (scopeTab === 'ACTIVE' && !person.is_active) return false;
    if (scopeTab === 'DISMISSED' && person.is_active) return false;

    // 2. Role filter
    if (roleFilter && roleOf(person) !== roleFilter) return false;

    // 3. Floor only filter
    if (floorOnly && (!person.is_active || (!person.is_on_floor && person.status !== 'On Floor'))) return false;

    // 4. Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const match =
        (person.name && person.name.toLowerCase().includes(q)) ||
        (person.email && person.email.toLowerCase().includes(q)) ||
        (person.phone && person.phone.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // --- Modal Open Handlers ---
  const handleOpenAdd = () => {
    setActionError('');
    setAddForm({
      name: '',
      email: '',
      phone: '',
      role: 'baker',
      daily_wage: '1000',
      password: '',
      confirm_password: ''
    });
    setShowAddPassword(false);
    setShowAddConfirmPassword(false);
    setAddModalOpen(true);
  };

  const handleOpenEdit = worker => {
    setActionError('');
    setEditTarget(worker);
    setEditForm({
      name: worker.name || '',
      email: worker.email || '',
      phone: worker.phone || '',
      role: roleOf(worker),
      daily_wage: worker.daily_wage != null ? String(worker.daily_wage) : '1000',
      new_password: '',
      confirm_password: ''
    });
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
  };

  const handleOpenDismiss = worker => {
    setActionError('');
    setDismissReason('');
    setDismissTarget(worker);
  };

  const handleOpenReactivate = worker => {
    setActionError('');
    setReactivateTarget(worker);
  };

  // --- Form Submit Handlers ---
  const handleAddSubmit = async e => {
    e.preventDefault();
    setActionError('');

    if (!addForm.name.trim()) {
      setActionError('Full Name is required.');
      return;
    }
    if (!addForm.email.trim()) {
      setActionError('Email Address is required.');
      return;
    }
    const wageNum = parseFloat(addForm.daily_wage);
    if (isNaN(wageNum) || wageNum <= 0) {
      setActionError('Enter a valid positive daily wage.');
      return;
    }
    if (!addForm.password || addForm.password.length < 6) {
      setActionError('Password must be at least 6 characters long.');
      return;
    }
    if (addForm.password !== addForm.confirm_password) {
      setActionError('Passwords do not match. Please verify both fields.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: addForm.name.trim(),
        email: addForm.email.trim().toLowerCase(),
        phone: addForm.phone.trim() || null,
        role: addForm.role,
        daily_wage: wageNum,
        password: addForm.password
      };
      const result = unwrap(await ownerService.onboardWorker(payload));
      setAddModalOpen(false);
      setCreatedCredentials({
        name: payload.name,
        email: payload.email,
        role: payload.role,
        password: addForm.password,
        phone: payload.phone
      });
      setBannerNotice(`Team member "${payload.name}" successfully created.`);
      await refresh();
    } catch (err) {
      setActionError(err.message || 'Failed to create team member.');
    } finally {
      setBusy(false);
    }
  };

  const handleEditSubmit = async e => {
    e.preventDefault();
    setActionError('');

    if (!editForm.name.trim()) {
      setActionError('Full Name is required.');
      return;
    }
    const wageNum = parseFloat(editForm.daily_wage);
    if (isNaN(wageNum) || wageNum <= 0) {
      setActionError('Enter a valid positive daily wage.');
      return;
    }
    if (editForm.new_password) {
      if (editForm.new_password.length < 6) {
        setActionError('New password must be at least 6 characters long.');
        return;
      }
      if (editForm.new_password !== editForm.confirm_password) {
        setActionError('New passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        role: editForm.role,
        daily_wage: wageNum
      };
      if (editForm.new_password) {
        payload.password = editForm.new_password;
      }
      await ownerService.updateWorker(editTarget.id, payload);
      setEditTarget(null);
      setBannerNotice(`Team member "${payload.name}" updated successfully.`);
      await refresh();
    } catch (err) {
      setActionError(err.message || 'Failed to update team member.');
    } finally {
      setBusy(false);
    }
  };

  const handleDismissSubmit = async () => {
    if (!dismissTarget) return;
    setBusy(true);
    setActionError('');
    try {
      await ownerService.dismissWorker(dismissTarget.id, dismissReason || 'Dismissed by management');
      setBannerNotice(`Team member "${dismissTarget.name}" has been dismissed. Dashboard access revoked.`);
      setDismissTarget(null);
      await refresh();
    } catch (err) {
      setActionError(err.message || 'Failed to dismiss team member.');
    } finally {
      setBusy(false);
    }
  };

  const handleReactivateSubmit = async () => {
    if (!reactivateTarget) return;
    setBusy(true);
    setActionError('');
    try {
      await ownerService.reactivateWorker(reactivateTarget.id);
      setBannerNotice(`Team member "${reactivateTarget.name}" has been reactivated. Portal access restored.`);
      setReactivateTarget(null);
      await refresh();
    } catch (err) {
      setActionError(err.message || 'Failed to reactivate team member.');
    } finally {
      setBusy(false);
    }
  };

  const credentialText = createdCredentials
    ? `Crumb & Co. Staff Account Created:\nName: ${createdCredentials.name}\nRole: ${roles[createdCredentials.role] || createdCredentials.role}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nLogin: ${window.location.origin}/${createdCredentials.role === 'manager' ? 'owner' : 'staff'}/login`
    : '';

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(credentialText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setActionError('Clipboard copy unavailable. Please select text manually.');
    }
  };

  return (
    <div className="owner-workspace ot-page">
      {/* Executive Page Header */}
      <PageHeader
        eyebrow="Bakery workforce & access"
        title="Team Management"
        description="Oversee artisanal bakers, operations staff, shifts, daily wages, and portal credentials."
      >
        <RefreshButton loading={loading} onClick={refresh} />
        <button className="ow-button ow-button-primary" onClick={handleOpenAdd}>
          <UserPlus size={16} />
          <span>Add Worker</span>
        </button>
      </PageHeader>

      {/* Global Alerts */}
      <Notice error>{error?.message}</Notice>
      {bannerNotice && (
        <Notice>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>{bannerNotice}</span>
            <button
              onClick={() => setBannerNotice('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
            >
              ×
            </button>
          </div>
        </Notice>
      )}

      {/* Metric Strip (Owner UI Design System) */}
      <MetricStrip
        items={[
          {
            icon: Users,
            label: 'Total Active Staff',
            value: activeStaff.length,
            note: 'Configured on active roster'
          },
          {
            icon: ChefHat,
            label: 'Deck Bakers',
            value: activeBakers.length,
            note: 'Artisanal baking team'
          },
          {
            icon: Shield,
            label: 'Operations & Managers',
            value: activeManagers.length,
            note: 'Packaging & floor supervision'
          },
          {
            icon: UserMinus,
            label: 'Former / Dismissed',
            value: dismissedStaff.length,
            note: 'Historical records preserved'
          }
        ]}
      />

      {/* Two-Column Layout: Main Roster & Insights Sidebar */}
      <div className="ot-layout" style={{ marginTop: '24px' }}>
        {/* Left Column: Directory Roster */}
        <div className="ot-directory">
          {/* Scope Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid var(--ow-line, #e8e0d7)',
              paddingBottom: '12px',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={() => setScopeTab('ACTIVE')}
              className={`ow-button ${scopeTab === 'ACTIVE' ? 'ow-button-primary' : 'ow-button-light'}`}
              style={{ minHeight: '34px', padding: '6px 14px', fontSize: '12px' }}
            >
              <Users size={14} />
              <span>Active Team ({activeStaff.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setScopeTab('DISMISSED')}
              className={`ow-button ${scopeTab === 'DISMISSED' ? 'ow-button-primary' : 'ow-button-light'}`}
              style={{ minHeight: '34px', padding: '6px 14px', fontSize: '12px' }}
            >
              <UserMinus size={14} />
              <span>Former / Dismissed ({dismissedStaff.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setScopeTab('ALL')}
              className={`ow-button ${scopeTab === 'ALL' ? 'ow-button-primary' : 'ow-button-light'}`}
              style={{ minHeight: '34px', padding: '6px 14px', fontSize: '12px' }}
            >
              <span>All Staff Records ({workers.length})</span>
            </button>
          </div>

          {/* Search & Role Filters Toolbar */}
          <div className="ot-filters">
            <label className="ow-search">
              <Search size={16} />
              <input
                aria-label="Search team"
                placeholder="Find a worker by name, email or phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>

            <select
              className="ow-select"
              aria-label="Filter team by role"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="baker">Bakers</option>
              <option value="staff">Packaging Staff</option>
              <option value="manager">Operations Managers</option>
            </select>

            {scopeTab !== 'DISMISSED' && (
              <button
                className="ow-button"
                aria-pressed={floorOnly}
                onClick={() => setFloorOnly(!floorOnly)}
              >
                <span className="ot-live-dot" />
                <span>On the Floor ({floorStaff.length})</span>
              </button>
            )}
          </div>

          {/* Worker Cards Roster Panel */}
          <section className="ow-panel ot-roster" aria-label="Team directory">
            <div className="ot-table-caption">
              <span>
                {scopeTab === 'ACTIVE'
                  ? 'ACTIVE TEAM DIRECTORY'
                  : scopeTab === 'DISMISSED'
                  ? 'DISMISSED / FORMER STAFF DIRECTORY'
                  : 'ALL STAFF RECORDS'}
              </span>
              <small>
                {filteredWorkers.length} {filteredWorkers.length === 1 ? 'person' : 'people'}
              </small>
            </div>

            {loading && !data ? (
              <EmptyState title="Loading team records…" />
            ) : filteredWorkers.length > 0 ? (
              filteredWorkers.map(person => {
                const isActive = Boolean(person.is_active);
                const currentRole = roleOf(person);

                return (
                  <article
                    className="ot-person"
                    key={person.id}
                    style={{
                      opacity: isActive ? 1 : 0.82,
                      backgroundColor: !isActive ? '#faf7f4' : undefined
                    }}
                  >
                    {/* Role Avatar */}
                    <div className={`ot-avatar ot-avatar-${currentRole}`}>
                      {initials(person.name)}
                    </div>

                    {/* Person Metadata */}
                    <div className="ot-person-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0 }}>{person.name}</h3>
                        {!isActive && (
                          <span
                            className="ow-badge ow-badge-danger"
                            style={{ fontSize: '10px', padding: '2px 8px' }}
                          >
                            <span />
                            Dismissed
                          </span>
                        )}
                      </div>

                      <span style={{ display: 'block', marginTop: '2px' }}>
                        {roles[currentRole] || person.role}
                      </span>

                      <div className="ot-contact">
                        <a href={`mailto:${person.email}`} title="Email address">
                          <Mail size={12} />
                          <span>{person.email}</span>
                        </a>
                        {person.phone && (
                          <a href={`tel:${person.phone}`} title="Phone number">
                            <Phone size={12} />
                            <span>{person.phone}</span>
                          </a>
                        )}
                        {!isActive && person.dismissed_at && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: 'var(--ow-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '2px'
                            }}
                          >
                            <Calendar size={11} />
                            <span>
                              Dismissed: {new Date(person.dismissed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {person.dismissal_reason ? ` • ${person.dismissal_reason}` : ''}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shift & Floor Status */}
                    <div className="ot-person-shift">
                      {isActive ? (
                        <>
                          <StatusBadge
                            value={person.status || 'Off Shift'}
                            tone={person.is_on_floor || person.status === 'On Floor' ? 'success' : 'neutral'}
                          />
                          <p>
                            <Clock3 size={12} />
                            <span>{person.shift || 'Flexible Shift'}</span>
                          </p>
                        </>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--ow-muted)', fontStyle: 'italic' }}>
                          Dashboard access revoked
                        </div>
                      )}
                    </div>

                    {/* Daily Wage Display */}
                    <div className="ot-person-wage">
                      <strong>{money(person.daily_wage)}</strong>
                      <small>daily wage</small>
                    </div>

                    {/* Contextual Actions Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {isActive ? (
                        <>
                          <button
                            type="button"
                            className="ow-button ow-button-light"
                            aria-label={`Edit ${person.name}`}
                            onClick={() => handleOpenEdit(person)}
                            title="Edit details & wages"
                            style={{ minHeight: '30px', padding: '4px 10px', fontSize: '11px' }}
                          >
                            <Pencil size={13} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="ow-button"
                            aria-label={`Dismiss ${person.name}`}
                            onClick={() => handleOpenDismiss(person)}
                            title="Dismiss staff member"
                            style={{
                              minHeight: '30px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              color: '#b91c1c',
                              borderColor: '#fca5a5',
                              backgroundColor: '#fff5f5'
                            }}
                          >
                            <UserMinus size={13} />
                            <span>Dismiss</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="ow-button ow-button-primary"
                          aria-label={`Reactivate ${person.name}`}
                          onClick={() => handleOpenReactivate(person)}
                          title="Restore staff member"
                          style={{ minHeight: '30px', padding: '4px 12px', fontSize: '11px' }}
                        >
                          <UserCheck size={13} />
                          <span>Reactivate</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <EmptyState
                title={
                  scopeTab === 'DISMISSED'
                    ? 'No dismissed team members'
                    : workers.length > 0
                    ? 'No staff members match the current filter'
                    : 'Your team roster is empty'
                }
                action={
                  scopeTab === 'ACTIVE' && workers.length === 0 ? (
                    <button className="ow-button ow-button-primary" onClick={handleOpenAdd}>
                      <UserPlus size={15} />
                      <span>Add your first team member</span>
                    </button>
                  ) : null
                }
              >
                {scopeTab === 'DISMISSED'
                  ? 'All staff members are currently in good standing on the active roster.'
                  : workers.length > 0
                  ? 'Try clearing the search query or adjusting the role filter.'
                  : 'Add bakers, packaging staff, or kitchen managers to establish their credentials.'}
              </EmptyState>
            )}
          </section>

          <p className="ow-footer-note">
            Updated {lastUpdatedLabel.toLowerCase()} · Status sourced from active production orders, shifts, and credentials.
          </p>
        </div>

        {/* Right Column: Wage Book & Kitchen Insights Sidebar */}
        <aside className="ot-sidebar">
          {/* Daily Wage Book Panel */}
          <section className="ot-wage-note">
            <div className="ow-eyebrow">The daily wage book</div>
            <h2>{data ? money(totalActiveWage) : '—'}</h2>
            <p>Total configured daily wages across active team</p>
            <div>
              <span>Average per active person</span>
              <strong>{data && activeStaff.length ? money(totalActiveWage / activeStaff.length) : '—'}</strong>
            </div>
            <small>
              Planning figures across active staff. Historical wages frozen in completed orders and batch logs are preserved.
            </small>
          </section>

          {/* Role Balance Breakdown */}
          <section className="ot-role-sheet">
            <h2>A team in balance</h2>
            {Object.entries(roles).map(([key, label]) => {
              const Icon = key === 'baker' ? ChefHat : key === 'manager' ? Shield : PackageCheck;
              const count = activeStaff.filter(person => roleOf(person) === key).length;
              const pct = activeStaff.length ? (count / activeStaff.length) * 100 : 0;

              return (
                <div className="ot-role-row" key={key}>
                  <Icon size={18} strokeWidth={1.5} />
                  <span>
                    {label}
                    <span className="ot-role-bar">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </section>

          {/* Floor Standby & Active Batches Note */}
          <section className="ot-floor-note">
            <div className="ow-eyebrow">From the deck oven</div>
            <h2>On the floor today</h2>
            {floorStaff.length > 0 ? (
              floorStaff.map(person => (
                <div key={person.id}>
                  <span className="ot-live-dot" />
                  <p>
                    <strong>{person.name}</strong>
                    <small>{hasBatch(person) ? person.active_batch : 'Floor Operations Standby'}</small>
                  </p>
                </div>
              ))
            ) : (
              <p>No team members are currently clocked in on the floor.</p>
            )}
            <a className="ow-text-link" href="/owner/production">
              Open production station
              <ArrowUpRight size={14} />
            </a>
          </section>
        </aside>
      </div>

      {/* ============================================================== */}
      {/* ADD WORKER DIALOG (WITH PASSWORD SETUP & VALIDATION)          */}
      {/* ============================================================== */}
      {addModalOpen && (
        <Dialog
          title="Onboard New Team Member"
          description="Create a worker profile and establish their login credentials."
          onClose={() => {
            if (!busy) setAddModalOpen(false);
          }}
          footer={
            <>
              <button
                type="button"
                className="ow-button"
                disabled={busy}
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </button>
              <button
                form="add-worker-form"
                type="submit"
                className="ow-button ow-button-primary"
                disabled={busy}
              >
                {busy ? 'Creating Account…' : 'Create Staff Account'}
              </button>
            </>
          }
        >
          <form id="add-worker-form" className="ow-form" onSubmit={handleAddSubmit}>
            <Notice error>{actionError}</Notice>

            {/* Personal Details */}
            <label className="ow-field">
              Full Name *
              <input
                required
                maxLength={120}
                placeholder="e.g. Ramesh Patel"
                value={addForm.name}
                onChange={e => setAddForm({ ...addForm, name: e.target.value })}
              />
            </label>

            <div className="ow-form-grid">
              <label className="ow-field">
                Email Address *
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="off"
                  placeholder="ramesh@crumbco.com"
                  value={addForm.email}
                  onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                />
                <small>Used for sign-in and password recovery.</small>
              </label>

              <label className="ow-field">
                Phone Number
                <input
                  type="tel"
                  maxLength={25}
                  placeholder="+91-98201-00000"
                  value={addForm.phone}
                  onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                />
              </label>
            </div>

            {/* Role & Daily Wage */}
            <div className="ow-form-grid">
              <label className="ow-field">
                Role *
                <select
                  value={addForm.role}
                  onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                >
                  <option value="baker">Artisanal Deck Baker</option>
                  <option value="staff">Packaging & Dispatch Staff</option>
                  <option value="manager">Kitchen & Operations Manager</option>
                </select>
              </label>

              <label className="ow-field">
                Daily Wage (₹) *
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="1000"
                  value={addForm.daily_wage}
                  onChange={e => setAddForm({ ...addForm, daily_wage: e.target.value })}
                />
                <small>Used for planning & labor budgeting.</small>
              </label>
            </div>

            {/* Password Setup */}
            <div
              style={{
                backgroundColor: 'var(--ow-wash, #f5f0e9)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--ow-line, #e8e0d7)',
                marginTop: '8px'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--ow-ink, #30251f)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Lock size={13} style={{ color: 'var(--ow-accent)' }} />
                <span>Account Credentials (Worker Login)</span>
              </div>

              <div className="ow-form-grid">
                <label className="ow-field">
                  Password *
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      required
                      type={showAddPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min 6 characters"
                      value={addForm.password}
                      onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                      style={{ paddingRight: '36px', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPassword(!showAddPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--ow-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      aria-label="Toggle password visibility"
                    >
                      {showAddPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <label className="ow-field">
                  Confirm Password *
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      required
                      type={showAddConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      value={addForm.confirm_password}
                      onChange={e => setAddForm({ ...addForm, confirm_password: e.target.value })}
                      style={{ paddingRight: '36px', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddConfirmPassword(!showAddConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--ow-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      aria-label="Toggle confirm password visibility"
                    >
                      {showAddConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>
              </div>

              {addForm.password && addForm.confirm_password && addForm.password !== addForm.confirm_password && (
                <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  <span>Passwords do not match</span>
                </div>
              )}
            </div>
          </form>
        </Dialog>
      )}

      {/* ============================================================== */}
      {/* EDIT WORKER DIALOG (WITH OPTIONAL PASSWORD RESET)              */}
      {/* ============================================================== */}
      {editTarget && (
        <Dialog
          title={`Edit Staff Profile — ${editTarget.name}`}
          description="Update employment details, daily wage, or initiate a password reset."
          onClose={() => {
            if (!busy) setEditTarget(null);
          }}
          footer={
            <>
              <button
                type="button"
                className="ow-button"
                disabled={busy}
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </button>
              <button
                form="edit-worker-form"
                type="submit"
                className="ow-button ow-button-primary"
                disabled={busy}
              >
                {busy ? 'Saving Changes…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <form id="edit-worker-form" className="ow-form" onSubmit={handleEditSubmit}>
            <Notice error>{actionError}</Notice>

            <label className="ow-field">
              Full Name *
              <input
                required
                maxLength={120}
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              />
            </label>

            <div className="ow-form-grid">
              <label className="ow-field">
                Email Address
                <input
                  type="email"
                  disabled
                  value={editForm.email}
                  style={{ backgroundColor: '#f5f0e9', cursor: 'not-allowed', color: 'var(--ow-muted)' }}
                />
                <small>Email is permanently tied to account authentication.</small>
              </label>

              <label className="ow-field">
                Phone Number
                <input
                  type="tel"
                  maxLength={25}
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </label>
            </div>

            <div className="ow-form-grid">
              <label className="ow-field">
                Role *
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="baker">Artisanal Deck Baker</option>
                  <option value="staff">Packaging & Dispatch Staff</option>
                  <option value="manager">Kitchen & Operations Manager</option>
                </select>
              </label>

              <label className="ow-field">
                Daily Wage (₹) *
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={editForm.daily_wage}
                  onChange={e => setEditForm({ ...editForm, daily_wage: e.target.value })}
                />
                <small>Updating wages only applies to future tasks.</small>
              </label>
            </div>

            {/* Optional Password Reset */}
            <div
              style={{
                backgroundColor: 'var(--ow-wash, #f5f0e9)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--ow-line, #e8e0d7)',
                marginTop: '10px'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--ow-ink, #30251f)',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Lock size={13} style={{ color: 'var(--ow-accent)' }} />
                <span>Reset Account Password (Optional)</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '11px', color: 'var(--ow-muted)' }}>
                Leave both fields blank to preserve the staff member's existing password.
              </p>

              <div className="ow-form-grid">
                <label className="ow-field">
                  New Password
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Enter new password"
                      value={editForm.new_password}
                      onChange={e => setEditForm({ ...editForm, new_password: e.target.value })}
                      style={{ paddingRight: '36px', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--ow-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      aria-label="Toggle new password visibility"
                    >
                      {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <label className="ow-field">
                  Confirm New Password
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showEditConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat new password"
                      value={editForm.confirm_password}
                      onChange={e => setEditForm({ ...editForm, confirm_password: e.target.value })}
                      style={{ paddingRight: '36px', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--ow-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      aria-label="Toggle confirm new password visibility"
                    >
                      {showEditConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>
              </div>

              {editForm.new_password && editForm.confirm_password && editForm.new_password !== editForm.confirm_password && (
                <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  <span>New passwords do not match</span>
                </div>
              )}
            </div>
          </form>
        </Dialog>
      )}

      {/* ============================================================== */}
      {/* DISMISS WORKER CONFIRMATION DIALOG                            */}
      {/* ============================================================== */}
      {dismissTarget && (
        <Dialog
          title="Dismiss Team Member"
          description={`Revoke application access for ${dismissTarget.name}.`}
          onClose={() => {
            if (!busy) setDismissTarget(null);
          }}
          footer={
            <>
              <button
                type="button"
                className="ow-button"
                disabled={busy}
                onClick={() => setDismissTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ow-button"
                disabled={busy}
                onClick={handleDismissSubmit}
                style={{
                  backgroundColor: '#b91c1c',
                  color: '#ffffff',
                  borderColor: '#991b1b'
                }}
              >
                {busy ? 'Dismissing…' : 'Confirm Dismissal'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Notice error>{actionError}</Notice>

            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <AlertCircle size={20} style={{ color: '#b91c1c', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: 1.6 }}>
                <strong>Immediate Portal Access Revocation:</strong>
                <p style={{ margin: '6px 0 0' }}>
                  Dismissing <strong>{dismissTarget.name}</strong> ({roles[roleOf(dismissTarget)] || dismissTarget.role}) will immediately invalidate their authentication token and prevent any further logins to the worker dashboard.
                </p>
                <p style={{ margin: '6px 0 0', color: '#991b1b' }}>
                  ✓ All past attendance, recipe batches, orders, and wage records remain completely intact for accounting and auditing.
                </p>
              </div>
            </div>

            <label className="ow-field">
              Dismissal Reason / Note (Optional)
              <input
                maxLength={200}
                placeholder="e.g. End of seasonal contract, resignation, etc."
                value={dismissReason}
                onChange={e => setDismissReason(e.target.value)}
              />
              <small>Recorded in employee audit history.</small>
            </label>
          </div>
        </Dialog>
      )}

      {/* ============================================================== */}
      {/* REACTIVATE WORKER CONFIRMATION DIALOG                         */}
      {/* ============================================================== */}
      {reactivateTarget && (
        <Dialog
          title="Reactivate Team Member"
          description={`Restore portal access and roster status for ${reactivateTarget.name}.`}
          onClose={() => {
            if (!busy) setReactivateTarget(null);
          }}
          footer={
            <>
              <button
                type="button"
                className="ow-button"
                disabled={busy}
                onClick={() => setReactivateTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ow-button ow-button-primary"
                disabled={busy}
                onClick={handleReactivateSubmit}
              >
                {busy ? 'Reactivating…' : 'Confirm Reactivation'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Notice error>{actionError}</Notice>

            <div
              style={{
                backgroundColor: '#edf3eb',
                border: '1px solid #c6e6d4',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <CheckCircle2 size={20} style={{ color: '#226344', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: '#164e32', lineHeight: 1.6 }}>
                <strong>Return to Active Duty:</strong>
                <p style={{ margin: '6px 0 0' }}>
                  Reactivating <strong>{reactivateTarget.name}</strong> will return them to the active team roster and allow them to log into the staff portal with their existing credentials.
                </p>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* ============================================================== */}
      {/* NEW ACCOUNT CREDENTIALS DIALOG (POST-CREATION DISPLAY)        */}
      {/* ============================================================== */}
      {createdCredentials && (
        <Dialog
          title="New Team Member Ready"
          description={`Login credentials established for ${createdCredentials.name}.`}
          onClose={() => setCreatedCredentials(null)}
          footer={
            <button
              className="ow-button ow-button-primary"
              onClick={() => setCreatedCredentials(null)}
            >
              Done
            </button>
          }
        >
          <div className="ot-credentials">
            <div>
              <small>LOGIN PORTAL</small>
              <span>
                {window.location.origin}/{createdCredentials.role === 'manager' ? 'owner' : 'staff'}/login
              </span>
            </div>
            <div>
              <small>EMAIL / USERNAME</small>
              <strong>{createdCredentials.email}</strong>
            </div>
            <div>
              <small>CONFIGURED PASSWORD</small>
              <code>{createdCredentials.password}</code>
            </div>
          </div>

          <div className="ow-actions">
            <button className="ow-button" onClick={copyCredentials}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? 'Copied' : 'Copy login details'}</span>
            </button>
            {createdCredentials.phone && (
              <a
                className="ow-button"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://wa.me/${createdCredentials.phone.replace(/\D/g, '')}?text=${encodeURIComponent(credentialText)}`}
              >
                <span>Share via WhatsApp</span>
              </a>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
