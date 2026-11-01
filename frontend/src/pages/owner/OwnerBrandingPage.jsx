import React, { useEffect, useRef, useState } from 'react';
import { QRCode } from 'antd';
import { Palette, Building2, MapPin, CreditCard, Truck, Save, RotateCcw, ArrowUpRight, Wheat, Image as ImageIcon, Check, QrCode } from 'lucide-react';
import api from '../../services/api';
import { useBusiness } from '../../context/BusinessContext';
import { useAuth } from '../../context/AuthContext';
import { Notice, EmptyState, money, unwrap } from '../../components/owner/OwnerUI';
import '../../styles/owner-settings.css';

const hex = value => /^#[0-9a-f]{6}$/i.test(value);
const cardInk = value => { if (!hex(value)) return '#fff5e3'; const channels = [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .3 ? '#35261d' : '#fff5e3'; };
const imageUrl = value => /^(https?:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp);base64,)/i.test(value || '');
const mapBusiness = b => ({
  name: b.name ?? '', tagline: b.tagline ?? '', logo_url: b.logoUrl ?? b.logo_url ?? '',
  primary_color: b.branding?.primaryColor ?? b.primary_color ?? '#5A3825', secondary_color: b.branding?.secondaryColor ?? b.secondary_color ?? '#8B5A2B', accent_color: b.branding?.accentColor ?? b.accent_color ?? '#D96C8A',
  contact_email: b.contact?.email ?? b.contact_email ?? '', contact_phone: b.contact?.phone ?? b.contact_phone ?? '',
  address_line1: b.address?.line1 ?? b.address_line1 ?? '', city: b.address?.city ?? b.city ?? '', postal_code: b.address?.postalCode ?? b.postal_code ?? '',
  fssai_license: b.fssaiLicense ?? b.fssai_license ?? '', upi_vpa: b.upiVpa ?? b.upi_vpa ?? '', upi_qr_image: b.upiQrImage ?? b.upi_qr_image ?? '',
});
function BrandImage({ src, name }) {
  const [failed, setFailed] = useState(false);
  return src && imageUrl(src) && !failed ? <img src={src} alt={`${name || 'Bakery'} logo`} onError={() => setFailed(true)} /> : <span className="ob-logo-fallback"><Wheat size={29} strokeWidth={1.2} /></span>;
}
function StudioSection({ id, number, title, description, children, Icon }) { return <section id={id} className="ob-section"><header><span className="ob-section-number">{number}</span><div><h2>{title}</h2><p>{description}</p></div><Icon size={22} strokeWidth={1.3} /></header><div className="ob-section-body">{children}</div></section>; }

export default function OwnerBrandingPage() {
  const { slug: storefrontSlug, loadBusiness } = useBusiness();
  const { business: accountBusiness, user } = useAuth();
  const slug = accountBusiness?.slug || storefrontSlug;
  const businessId = user?.business_id || accountBusiness?.id;
  const [form, setForm] = useState(null), [saved, setSaved] = useState(null), [pricing, setPricing] = useState(null), [savedPricing, setSavedPricing] = useState(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [savingPricing, setSavingPricing] = useState(false);
  const [error, setError] = useState(''), [pricingError, setPricingError] = useState(''), [success, setSuccess] = useState(''), [qrMode, setQrMode] = useState('auto'), [reload, setReload] = useState(0);
  const qrRef = useRef(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setForm(null); setSaved(null); setError(''); setPricingError('');
      const results = await Promise.allSettled([api.get(`/business/${encodeURIComponent(slug)}`), api.get('/owner/settings/pricing')]);
      if (!active) return;
      if (results[0].status === 'fulfilled') { const record = unwrap(results[0].value); if (businessId && Number(record.id) !== Number(businessId)) setError('The loaded business does not match your owner account. Sign in to the correct bakery to edit these settings.'); else { const profile = mapBusiness(record); setForm(profile); setSaved(profile); setQrMode(profile.upi_qr_image ? 'custom' : 'auto'); } }
      else setError(results[0].reason.message || 'Could not load your saved business profile.');
      if (results[1].status === 'fulfilled') { const rates = unwrap(results[1].value); setPricing(rates); setSavedPricing(rates); }
      else setPricingError(results[1].reason.message || 'Could not load delivery pricing.');
      setLoading(false);
    };
    if (slug) load();
    return () => { active = false; };
  }, [slug, businessId, reload]);
  const dirty = form && JSON.stringify(form) !== JSON.stringify(saved);
  const pricingDirty = pricing && JSON.stringify(pricing) !== JSON.stringify(savedPricing);
  const update = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setSuccess(''); };
  const saveBrand = async event => {
    event.preventDefault(); setError(''); setSuccess('');
    if (!form.name.trim()) { setError('Enter your bakery name.'); return; }
    if (![form.primary_color, form.secondary_color, form.accent_color].every(hex)) { setError('Use a six-digit hex colour, such as #5A3825.'); return; }
    if ([form.logo_url, form.upi_qr_image].some(url => url && !imageUrl(url))) { setError('Use an HTTP image URL, a local asset path, or a PNG, JPEG or WebP data image.'); return; }
    if (form.upi_vpa && !/^[\w.-]+@[\w.-]+$/.test(form.upi_vpa.trim())) { setError('Enter a valid UPI ID in the form name@bank.'); return; }
    setSaving(true);
    try { const payload = { ...form, name: form.name.trim(), upi_vpa: form.upi_vpa.trim(), upi_qr_image: qrMode === 'auto' ? '' : form.upi_qr_image }; await api.put('/business/branding', payload); setSaved(payload); setForm(payload); setSuccess('Business profile and branding saved.'); await loadBusiness(slug); }
    catch (err) { setError(err.message || 'Could not save your branding.'); } finally { setSaving(false); }
  };
  const savePricing = async event => {
    event.preventDefault(); setPricingError(''); setSuccess(''); setSavingPricing(true);
    try { const payload = Object.fromEntries(['delivery_fee', 'free_delivery_threshold', 'delivery_gst_rate'].map(key => [key, Number(pricing[key])])); const result = unwrap(await api.patch('/owner/settings/pricing', payload)); setPricing(result); setSavedPricing(result); setSuccess('Delivery pricing saved.'); await loadBusiness(slug); }
    catch (err) { setPricingError(err.message || 'Could not save delivery pricing.'); } finally { setSavingPricing(false); }
  };
  const discard = () => { setForm({ ...saved }); setQrMode(saved.upi_qr_image ? 'custom' : 'auto'); setError(''); setSuccess(''); };
  const generateStandee = () => { const canvas = qrRef.current?.querySelector('canvas'); if (canvas) { update('upi_qr_image', canvas.toDataURL('image/png')); setQrMode('custom'); } };
  const field = (key, label, type = 'text', extra = {}) => <label className="ow-field">{label}<input type={type} value={form[key]} onChange={event => update(key, event.target.value)} {...extra} /></label>;
  return <div className="owner-workspace ob-page"><header className="ob-title"><div><div className="ow-eyebrow">Make it unmistakably yours</div><h1>Business & branding</h1><p>The details that turn a bakery into <em>your</em> bakery.</p></div><div className="ow-actions"><a className="ow-button" href="/" target="_blank" rel="noopener noreferrer">View storefront<ArrowUpRight size={14} /></a><button className="ow-button ow-button-primary" form="brand-profile-form" type="submit" disabled={!dirty || saving}><Save size={14} />Save profile</button></div></header><Notice>{success}</Notice><Notice error>{error}</Notice>
    {loading && !form ? <EmptyState title="Opening your brand studio…" /> : !form ? <EmptyState title="Your settings could not be loaded" action={<button className="ow-button" onClick={() => setReload(value => value + 1)}>Try again</button>}>No example contact or payment details have been substituted.</EmptyState> : <div className="ob-layout"><div className="ob-editor"><nav className="ob-section-nav" aria-label="Business settings sections"><a href="#brand-identity">Identity</a><a href="#brand-palette">Colours</a><a href="#brand-contact">Business details</a><a href="#brand-payments">Payments</a><a href="#brand-delivery">Delivery</a></nav><form id="brand-profile-form" onSubmit={saveBrand}>
      <StudioSection id="brand-identity" number="01" title="Your brand, at first glance" description="The name and mark customers will remember." Icon={Building2}><div className="ob-logo-editor"><div><BrandImage key={form.logo_url} src={form.logo_url} name={form.name} /></div><p>Your bakery's signature.<small>A clear logo works best across menus and receipts.</small></p></div><div className="ow-form-grid">{field('name', 'Bakery name', 'text', { required: true, maxLength: 120 })}{field('tagline', 'Tagline', 'text', { maxLength: 200 })}</div>{field('logo_url', 'Logo image URL or local asset path', 'text', { placeholder: '/assets/logos/your-logo.svg' })}</StudioSection>
      <StudioSection id="brand-palette" number="02" title="A palette with personality" description="Three colours to carry your identity through the storefront." Icon={Palette}><div className="ob-colours">{[['primary_color', 'Primary', 'Your signature colour'], ['secondary_color', 'Secondary', 'Depth and supporting details'], ['accent_color', 'Accent', 'Small moments of contrast']].map(([key, label, detail]) => <div className="ob-colour" key={key}><label className="ob-colour-swatch" style={{ background: hex(form[key]) ? form[key] : '#e4d9ca' }}><input aria-label={`${label} colour picker`} type="color" value={hex(form[key]) ? form[key] : '#5A3825'} onChange={event => update(key, event.target.value)} /><Check size={18} /></label><label className="ow-field">{label}<input aria-label={`${label} hex colour`} maxLength={7} value={form[key]} onChange={event => update(key, event.target.value)} /></label><small>{detail}</small></div>)}</div></StudioSection>
      <StudioSection id="brand-contact" number="03" title="The business behind the bake" description="Contact information, location, and your saved licence details." Icon={MapPin}><div className="ow-form-grid">{field('contact_email', 'Contact email', 'email')}{field('contact_phone', 'Contact phone', 'tel')}{field('address_line1', 'Street address', 'text', { maxLength: 255 })}{field('city', 'City', 'text', { maxLength: 100 })}{field('postal_code', 'Postal code', 'text', { maxLength: 20 })}{field('fssai_license', 'FSSAI licence number', 'text', { maxLength: 30 })}</div></StudioSection>
      <StudioSection id="brand-payments" number="04" title="A place for every payment" description="Manage the UPI destination saved for customer checkout." Icon={CreditCard}>{field('upi_vpa', 'UPI ID / virtual payment address', 'text', { placeholder: 'yourbakery@bank', maxLength: 100 })}<div className="ob-payment-options"><label><input type="radio" name="qr-mode" value="auto" checked={qrMode === 'auto'} onChange={() => { setQrMode('auto'); update('upi_qr_image', ''); }} /><span>Generate from UPI ID<small>A payment QR built from the destination above.</small></span></label><label><input type="radio" name="qr-mode" value="custom" checked={qrMode === 'custom'} onChange={() => setQrMode('custom')} /><span>Merchant QR image<small>Save an existing bank or merchant graphic.</small></span></label></div>{qrMode === 'custom' && <>{field('upi_qr_image', 'Merchant QR image URL or data image', 'text', { placeholder: 'https://… or data:image/png;base64,…' })}{form.upi_qr_image && imageUrl(form.upi_qr_image) && <img className="ob-merchant-qr" src={form.upi_qr_image} alt="Saved merchant QR graphic" />}</>}<div className="ob-qr-preview"><div ref={qrRef}>{form.upi_vpa ? <QRCode value={`upi://pay?pa=${encodeURIComponent(form.upi_vpa)}&pn=${encodeURIComponent(form.name)}&cu=INR`} size={130} bordered={false} type="canvas" /> : <div className="ob-qr-empty"><QrCode size={40} strokeWidth={1} /></div>}</div><div><strong>Payment destination preview</strong><p>{form.upi_vpa || 'Add a UPI ID to generate a QR.'}</p><small>Customer checkout generates its own QR with the order amount. This preview contains no amount.</small>{form.upi_vpa && <button type="button" className="ow-text-link" onClick={generateStandee}>Use generated QR as merchant image<ArrowUpRight size={13} /></button>}</div></div></StudioSection>
      <div className="ob-save-bar"><span className={dirty ? 'ob-unsaved' : ''}><i />{saving ? 'Saving your profile…' : dirty ? 'Unsaved profile changes' : 'Profile matches saved settings'}</span><div className="ow-actions"><button className="ow-button" type="button" disabled={!dirty || saving} onClick={discard}><RotateCcw size={14} />Discard</button><button className="ow-button ow-button-primary" disabled={!dirty || saving} type="submit"><Save size={14} />{saving ? 'Saving…' : 'Save business profile'}</button></div></div>
    </form><section id="brand-delivery" className="ob-section"><header><span className="ob-section-number">05</span><div><h2>From our door to theirs</h2><p>Delivery charges and tax, saved separately from your brand profile.</p></div><Truck size={22} strokeWidth={1.3} /></header><div className="ob-section-body"><Notice error>{pricingError}</Notice>{pricing ? <form className="ow-form" onSubmit={savePricing}><div className="ob-delivery-fields">{[['delivery_fee', 'Delivery charge (₹)'], ['free_delivery_threshold', 'Free delivery subtotal (₹)'], ['delivery_gst_rate', 'Delivery GST (%)']].map(([key, label]) => <label className="ow-field" key={key}>{label}<input required type="number" min="0" max={key === 'delivery_gst_rate' ? 100 : undefined} step="any" value={pricing[key]} onChange={event => setPricing({ ...pricing, [key]: event.target.value })} /></label>)}</div><div className="ob-delivery-footer"><p>Charged once per delivery order. Pickup and dine-in have no delivery charge.</p><button className="ow-button" type="submit" disabled={!pricingDirty || savingPricing}>{savingPricing ? 'Saving…' : 'Save delivery pricing'}</button></div></form> : <button className="ow-button" onClick={() => setReload(value => value + 1)}>Reload delivery settings</button>}</div></section></div>
    <aside className="ob-preview"><div className="ob-preview-label"><span><ImageIcon size={14} />YOUR BRAND, IN CONTEXT</span><small>{dirty ? 'Unsaved preview' : 'Saved profile'}</small></div><div className="ob-artboard"><div className="ob-brand-card" style={{ background: hex(form.primary_color) ? form.primary_color : '#5A3825', color: cardInk(form.primary_color) }}><div className="ob-brand-logo"><BrandImage key={form.logo_url} src={form.logo_url} name={form.name} /></div><h2>{form.name || 'Your bakery name'}</h2><p>{form.tagline || 'Your bakery tagline'}</p><span className="ob-brand-flourish"><Wheat size={49} strokeWidth={.7} /></span><div className="ob-brand-swatches">{['primary_color', 'secondary_color', 'accent_color'].map(key => <i key={key} style={{ background: hex(form[key]) ? form[key] : '#e4d9ca' }} />)}</div></div><div className="ob-receipt"><div className="ow-eyebrow">Business details preview</div><h3>{form.name || 'Your bakery name'}</h3><p>{[form.address_line1, form.city, form.postal_code].filter(Boolean).join(', ') || 'Address not set'}</p><p>{form.contact_phone || 'Phone not set'}<br />{form.contact_email || 'Email not set'}</p><div><span>FSSAI</span><strong>{form.fssai_license || 'Not set'}</strong></div><div><span>UPI</span><strong>{form.upi_vpa || 'Not set'}</strong></div></div></div><p className="ob-preview-note">Preview changes as you work. Save the business profile to apply them to the saved bakery identity.</p>{pricing && <div className="ob-delivery-note"><Truck size={20} strokeWidth={1.3} /><div><strong>{money(savedPricing?.delivery_fee)} delivery</strong><small>Saved charge before delivery GST</small></div></div>}</aside></div>}
  </div>;
}
