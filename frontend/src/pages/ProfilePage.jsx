import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  MapPin,
  Phone,
  Mail,
  Award,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Star,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Building,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import customerService from '../services/customerService';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { name: businessName, slug } = useBusiness();

  // Active section tab: 'profile' or 'addresses'
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [profileData, setProfileData] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // Addresses state
  const [addresses, setAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [addressErrorMsg, setAddressErrorMsg] = useState('');
  const [addressSuccessMsg, setAddressSuccessMsg] = useState('');

  // Address Modal/Form state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    address_line1: '',
    address_line2: '',
    city: 'Mumbai',
    postal_code: '',
    contact_phone: '',
    is_default: false,
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [formValidationError, setFormValidationError] = useState('');

  // Delete confirmation
  const [deletingAddressId, setDeletingAddressId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper for tenant-scoped links
  const bPath = (path) => {
    if (!slug) return path;
    return `/b/${slug}${path === '/' ? '' : path}`;
  };

  // Fetch initial profile and addresses from backend
  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const res = await customerService.getCustomerProfile();
        if (isMounted && res.success && res.data) {
          setProfileData(res.data);
          setProfileForm({
            name: res.data.name || '',
            phone: res.data.phone || '',
          });
        }
      } catch (err) {
        // Fallback to auth context user if offline / demo
        if (isMounted && user) {
          setProfileData(user);
          setProfileForm({
            name: user.name || '',
            phone: user.phone || '',
          });
        }
      }
    };

    const loadAddresses = async () => {
      setIsLoadingAddresses(true);
      try {
        const res = await customerService.getCustomerAddresses();
        if (isMounted && res.success && res.data) {
          setAddresses(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setAddressErrorMsg('Failed to load saved addresses.');
        }
      } finally {
        if (isMounted) setIsLoadingAddresses(false);
      }
    };

    loadProfile();
    loadAddresses();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileErrorMsg('');
    setProfileSuccessMsg('');

    if (!profileForm.name.trim()) {
      setProfileErrorMsg('Name cannot be empty.');
      return;
    }
    if (!profileForm.phone.trim() || profileForm.phone.trim().length < 8) {
      setProfileErrorMsg('Please enter a valid phone number (at least 8 digits).');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await customerService.updateCustomerProfile({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
      });

      if (res.success && res.data) {
        setProfileData(res.data);
        updateUser({
          name: res.data.name,
          phone: res.data.phone,
        });
        setIsEditingProfile(false);
        setProfileSuccessMsg('Profile updated successfully!');
        setTimeout(() => setProfileSuccessMsg(''), 4000);
      }
    } catch (err) {
      setProfileErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Open Add Address Modal
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: 'Home',
      address_line1: '',
      address_line2: '',
      city: 'Mumbai',
      postal_code: '',
      contact_phone: profileData?.phone || user?.phone || '',
      is_default: addresses.length === 0, // Auto-default if first address
    });
    setFormValidationError('');
    setShowAddressModal(true);
  };

  // Open Edit Address Modal
  const handleOpenEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label || 'Home',
      address_line1: addr.address_line1 || '',
      address_line2: addr.address_line2 || '',
      city: addr.city || 'Mumbai',
      postal_code: addr.postal_code || '',
      contact_phone: addr.contact_phone || '',
      is_default: Boolean(addr.is_default),
    });
    setFormValidationError('');
    setShowAddressModal(true);
  };

  // Save Address (Create or Update)
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setFormValidationError('');

    if (!addressForm.address_line1.trim()) {
      setFormValidationError('Street address is required.');
      return;
    }
    if (!addressForm.city.trim()) {
      setFormValidationError('City is required.');
      return;
    }
    if (!addressForm.postal_code.trim()) {
      setFormValidationError('Postal code / PIN code is required.');
      return;
    }
    if (!addressForm.contact_phone.trim() || addressForm.contact_phone.trim().length < 8) {
      setFormValidationError('A valid contact phone is required.');
      return;
    }

    setIsSavingAddress(true);
    try {
      if (editingAddressId) {
        // Update existing address
        const res = await customerService.updateCustomerAddress(editingAddressId, {
          label: addressForm.label,
          address_line1: addressForm.address_line1.trim(),
          address_line2: addressForm.address_line2 ? addressForm.address_line2.trim() : null,
          city: addressForm.city.trim(),
          postal_code: addressForm.postal_code.trim(),
          contact_phone: addressForm.contact_phone.trim(),
          is_default: addressForm.is_default,
        });

        if (res.success && res.data) {
          // Refresh list from backend to preserve authoritative single default address state
          const refreshed = await customerService.getCustomerAddresses();
          if (refreshed.success) setAddresses(refreshed.data);
          setShowAddressModal(false);
          setAddressSuccessMsg('Address updated successfully!');
          setTimeout(() => setAddressSuccessMsg(''), 4000);
        }
      } else {
        // Create new address
        const res = await customerService.createCustomerAddress({
          label: addressForm.label,
          address_line1: addressForm.address_line1.trim(),
          address_line2: addressForm.address_line2 ? addressForm.address_line2.trim() : null,
          city: addressForm.city.trim(),
          postal_code: addressForm.postal_code.trim(),
          contact_phone: addressForm.contact_phone.trim(),
          is_default: addressForm.is_default,
        });

        if (res.success && res.data) {
          const refreshed = await customerService.getCustomerAddresses();
          if (refreshed.success) setAddresses(refreshed.data);
          setShowAddressModal(false);
          setAddressSuccessMsg('New delivery address added!');
          setTimeout(() => setAddressSuccessMsg(''), 4000);
        }
      }
    } catch (err) {
      setFormValidationError(err.message || 'Failed to save address.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Set Address as Default
  const handleSetDefault = async (addressId) => {
    try {
      const res = await customerService.setDefaultCustomerAddress(addressId);
      if (res.success) {
        const refreshed = await customerService.getCustomerAddresses();
        if (refreshed.success) setAddresses(refreshed.data);
        setAddressSuccessMsg('Default delivery address updated.');
        setTimeout(() => setAddressSuccessMsg(''), 3000);
      }
    } catch (err) {
      setAddressErrorMsg(err.message || 'Could not set default address.');
      setTimeout(() => setAddressErrorMsg(''), 4000);
    }
  };

  // Delete Address
  const handleDeleteAddress = async (addressId) => {
    setIsDeleting(true);
    try {
      const res = await customerService.deleteCustomerAddress(addressId);
      if (res.success) {
        const refreshed = await customerService.getCustomerAddresses();
        if (refreshed.success) setAddresses(refreshed.data);
        setDeletingAddressId(null);
        setAddressSuccessMsg('Address deleted successfully.');
        setTimeout(() => setAddressSuccessMsg(''), 3000);
      }
    } catch (err) {
      setAddressErrorMsg(err.message || 'Could not delete address.');
      setTimeout(() => setAddressErrorMsg(''), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const rawName = profileData?.name || user?.name || 'Customer';
  const displayName = rawName.replace(/\s*\((Owner|Baker|Customer)\)/gi, '').trim();
  const displayEmail = profileData?.email || user?.email || '';
  const displayPhone = profileData?.phone || user?.phone || '';
  const displayInitials = user?.initials || (displayName && displayName !== 'Customer' ? displayName.slice(0, 2).toUpperCase() : 'CU');
  const crumbPoints = user?.crumbPoints || profileData?.points || 0;

  const handleSignOut = () => {
    logout();
    navigate(bPath('/login'));
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-canvas)', minHeight: 'calc(100vh - var(--header-height))', padding: '36px 0 80px' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
          <Link to={bPath('/')} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Home
          </Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>My Account & Addresses</span>
        </div>

        {/* Profile Hero Header Card */}
        <div
          className="card"
          style={{
            padding: '28px 32px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FDF9F5 100%)',
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-brand-primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '1px',
                boxShadow: '0 4px 10px rgba(90, 56, 37, 0.2)',
                flexShrink: 0,
              }}
            >
              {displayInitials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="font-serif" style={{ fontSize: '26px', color: 'var(--text-primary)', margin: 0 }}>
                  {displayName}
                </h1>
                {user?.role === 'owner' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        backgroundColor: 'rgba(217, 119, 6, 0.12)',
                        color: '#B45309',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      Bakery Owner
                    </span>
                    <Link
                      to="/owner"
                      className="btn btn-sm btn-pill"
                      style={{
                        backgroundColor: '#5A3825',
                        color: '#FFFFFF',
                        padding: '3px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Owner Portal →
                    </Link>
                  </div>
                ) : user?.role === 'baker' || user?.role === 'staff' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                        color: '#1D4ED8',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      👨‍🍳 Kitchen Staff
                    </span>
                    <Link
                      to="/staff/tasks"
                      className="btn btn-sm btn-pill"
                      style={{
                        backgroundColor: '#C25E00',
                        color: '#FFFFFF',
                        padding: '3px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Kitchen Floor →
                    </Link>
                  </div>
                ) : (
                  <span
                    style={{
                      backgroundColor: 'rgba(90, 56, 37, 0.08)',
                      color: 'var(--color-brand-primary)',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Customer Account
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                {[displayEmail, displayPhone].filter(Boolean).join(' • ') || 'Customer Profile'}
              </p>
            </div>
          </div>

          {/* Right Header Actions: Rewards Badge & Sign Out Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'var(--bg-surface-soft)',
                padding: '10px 18px',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
              }}
            >
              <Award size={24} color="#D97706" />
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Crumb Rewards
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {crumbPoints} Pts
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="btn btn-pill"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #FFCDD2',
                color: '#D32F2F',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Sign Out of Customer Account"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '1px solid var(--border-medium)',
            paddingBottom: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              backgroundColor: activeTab === 'profile' ? 'var(--color-brand-primary)' : 'transparent',
              color: activeTab === 'profile' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            <User size={18} />
            Personal Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('addresses')}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              backgroundColor: activeTab === 'addresses' ? 'var(--color-brand-primary)' : 'transparent',
              color: activeTab === 'addresses' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
          >
            <MapPin size={18} />
            Saved Addresses ({addresses.length})
          </button>
        </div>

        {/* Feedback Banners */}
        {profileSuccessMsg && (
          <div
            style={{
              backgroundColor: '#E8F5E9',
              color: '#2E7D32',
              padding: '12px 18px',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              border: '1px solid #A5D6A7',
            }}
          >
            <CheckCircle size={18} />
            {profileSuccessMsg}
          </div>
        )}

        {addressSuccessMsg && (
          <div
            style={{
              backgroundColor: '#E8F5E9',
              color: '#2E7D32',
              padding: '12px 18px',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              border: '1px solid #A5D6A7',
            }}
          >
            <CheckCircle size={18} />
            {addressSuccessMsg}
          </div>
        )}

        {addressErrorMsg && (
          <div
            style={{
              backgroundColor: '#FFEBEE',
              color: '#C62828',
              padding: '12px 18px',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              border: '1px solid #EF9A9A',
            }}
          >
            <AlertCircle size={18} />
            {addressErrorMsg}
          </div>
        )}

        {/* TAB 1: PERSONAL DETAILS */}
        {activeTab === 'profile' && (
          <div className="card" style={{ padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Personal Information
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Manage your personal contact details used for deliveries and bakery order updates.
                </p>
              </div>

              {!isEditingProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="btn btn-outline"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    fontSize: '14px',
                  }}
                >
                  <Edit2 size={15} />
                  Edit Profile
                </button>
              )}
            </div>

            {profileErrorMsg && (
              <div
                style={{
                  backgroundColor: '#FFEBEE',
                  color: '#C62828',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  border: '1px solid #EF9A9A',
                }}
              >
                <AlertCircle size={18} />
                {profileErrorMsg}
              </div>
            )}

            {!isEditingProfile ? (
              /* View Mode */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    <User size={14} /> FULL NAME
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {displayName}
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    <Mail size={14} /> EMAIL ADDRESS
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {displayEmail}
                  </div>
                  <div style={{ fontSize: '11px', color: '#2E7D32', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} /> Verified login credential
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    <Phone size={14} /> PHONE NUMBER
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {displayPhone}
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: 'var(--bg-surface-soft)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                    <Building size={14} /> ACTIVE BAKERY
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {businessName || 'Crumb & Co.'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Multi-tenant member ID #{profileData?.id || user?.id || 4}
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Form */
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Your Full Name"
                      required
                      style={{ width: '100%', minHeight: '44px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      className="input"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+91 98201 54321"
                      required
                      style={{ width: '100%', minHeight: '44px' }}
                    />
                  </div>
                </div>

                {/* Read-only notification for email and role */}
                <div style={{ backgroundColor: 'var(--bg-surface-soft)', padding: '14px', borderRadius: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Email address (<strong>{displayEmail}</strong>) and account role are protected login credentials and cannot be edited directly by customer.
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileForm({
                        name: profileData?.name || user?.name || '',
                        phone: profileData?.phone || user?.phone || '',
                      });
                      setProfileErrorMsg('');
                    }}
                    className="btn btn-outline"
                    disabled={isSavingProfile}
                    style={{ minHeight: '44px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingProfile}
                    style={{ minHeight: '44px', minWidth: '130px' }}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: SAVED ADDRESSES */}
        {activeTab === 'addresses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Delivery Addresses
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Saved addresses are automatically available during checkout for speedy delivery.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddAddress}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  minHeight: '44px',
                }}
              >
                <Plus size={16} />
                Add New Address
              </button>
            </div>

            {/* Addresses List / Empty State */}
            {isLoadingAddresses ? (
              <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading your delivery addresses...
              </div>
            ) : addresses.length === 0 ? (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(90, 56, 37, 0.08)',
                    color: 'var(--color-brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <MapPin size={32} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  No saved addresses found
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '420px', margin: '0 auto 20px' }}>
                  Add a delivery address now so you can breeze through checkout when placing artisan bakery orders.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddAddress}
                  className="btn btn-primary"
                  style={{ minHeight: '44px' }}
                >
                  + Add Your First Address
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                {addresses.map((addr) => {
                  const isDefault = Boolean(addr.is_default);

                  return (
                    <div
                      key={addr.id}
                      className="card"
                      style={{
                        padding: '24px',
                        border: isDefault ? '2px solid var(--color-brand-primary)' : '1px solid var(--border-medium)',
                        backgroundColor: isDefault ? '#FDF9F5' : 'var(--bg-surface)',
                        boxShadow: isDefault ? '0 2px 8px rgba(90, 56, 37, 0.08)' : 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              backgroundColor: 'rgba(90, 56, 37, 0.1)',
                              color: 'var(--color-brand-primary)',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {addr.label || 'Home'}
                          </span>

                          {isDefault && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#2E7D32',
                                color: '#FFFFFF',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <Star size={11} fill="#FFFFFF" />
                              DEFAULT ADDRESS
                            </span>
                          )}
                        </div>

                        {/* Actions Toolbar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {!isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(addr.id)}
                              className="btn btn-outline"
                              style={{ padding: '6px 12px', fontSize: '12px', minHeight: '36px' }}
                            >
                              Set as Default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditAddress(addr)}
                            aria-label="Edit address"
                            className="btn btn-outline"
                            style={{ padding: '6px 10px', fontSize: '12px', minHeight: '36px' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingAddressId(addr.id)}
                            aria-label="Delete address"
                            className="btn btn-outline"
                            style={{
                              padding: '6px 10px',
                              fontSize: '12px',
                              minHeight: '36px',
                              color: '#C62828',
                              borderColor: '#FFCDD2',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Address Details */}
                      <div>
                        <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                          {addr.address_line1}
                        </div>
                        {addr.address_line2 && (
                          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {addr.address_line2}
                          </div>
                        )}
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {addr.city}, {addr.postal_code}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={13} />
                          Delivery Contact: <strong style={{ color: 'var(--text-primary)' }}>{addr.contact_phone}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ADD / EDIT ADDRESS MODAL */}
        {showAddressModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(31, 22, 16, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '16px',
              backdropFilter: 'blur(3px)',
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '560px',
                padding: '28px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-xl)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                {editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Ensure your delivery street and contact number are accurate.
              </p>

              {formValidationError && (
                <div
                  style={{
                    backgroundColor: '#FFEBEE',
                    color: '#C62828',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  {formValidationError}
                </div>
              )}

              <form onSubmit={handleSaveAddress} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Address Label Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Address Label
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['Home', 'Work', 'Other'].map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setAddressForm({ ...addressForm, label: lbl })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-medium)',
                          backgroundColor: addressForm.label === lbl ? 'var(--color-brand-primary)' : 'var(--bg-surface)',
                          color: addressForm.label === lbl ? '#FFFFFF' : 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Street Address Line 1 */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Flat / House No. / Building / Street *
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={addressForm.address_line1}
                    onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                    placeholder="e.g. Flat 402, Sea Breeze Apts, Carter Road"
                    required
                    style={{ width: '100%', minHeight: '44px' }}
                  />
                </div>

                {/* Landmark / Line 2 */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Area / Landmark / Suite (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={addressForm.address_line2}
                    onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
                    placeholder="e.g. Near Cafe Basilico, Bandra West"
                    style={{ width: '100%', minHeight: '44px' }}
                  />
                </div>

                {/* City & PIN Code Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      City *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      placeholder="e.g. Mumbai"
                      required
                      style={{ width: '100%', minHeight: '44px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Postal / PIN Code *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="input"
                      value={addressForm.postal_code}
                      onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                      placeholder="e.g. 400050"
                      required
                      style={{ width: '100%', minHeight: '44px' }}
                    />
                  </div>
                </div>

                {/* Contact Phone */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Delivery Contact Phone *
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    className="input"
                    value={addressForm.contact_phone}
                    onChange={(e) => setAddressForm({ ...addressForm, contact_phone: e.target.value })}
                    placeholder="+91 98201 54321"
                    required
                    style={{ width: '100%', minHeight: '44px' }}
                  />
                </div>

                {/* Set as Default Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={addressForm.is_default}
                    onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--color-brand-primary)' }}
                  />
                  <span>Set as my default delivery address</span>
                </label>

                {/* Modal Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(false)}
                    className="btn btn-outline"
                    disabled={isSavingAddress}
                    style={{ minHeight: '44px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingAddress}
                    style={{ minHeight: '44px', minWidth: '130px' }}
                  >
                    {isSavingAddress ? 'Saving...' : 'Save Address'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {deletingAddressId && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(31, 22, 16, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '440px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#FFEBEE',
                  color: '#C62828',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Trash2 size={26} />
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Delete this address?
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Are you sure you want to remove this saved delivery address? This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setDeletingAddressId(null)}
                  className="btn btn-outline"
                  disabled={isDeleting}
                  style={{ minHeight: '44px', flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAddress(deletingAddressId)}
                  className="btn"
                  disabled={isDeleting}
                  style={{
                    minHeight: '44px',
                    flex: 1,
                    backgroundColor: '#C62828',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
