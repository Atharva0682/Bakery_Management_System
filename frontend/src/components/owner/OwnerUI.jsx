import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, RefreshCw, X, Wheat, Wallet, ShoppingBag, ChefHat, PackageCheck, Inbox } from 'lucide-react';
import '../../styles/owner-workspace.css';

export const unwrap = response => response?.data ?? response;
export const listOf = response => { const value = unwrap(response); return Array.isArray(value) ? value : []; };
export const money = value => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
export const quantity = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(value || 0));
export const terminalOrder = order => ['Delivered', 'Cancelled', 'Rejected'].includes(order.order_status || order.status);
export function dateLabel(value, time = false) {
  if (!value) return '—';
  const text = String(value);
  const date = new Date(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(text) && !/Z$|[+-]\d\d:\d\d$/.test(text) ? text.replace(' ', 'T') + 'Z' : text);
  return Number.isNaN(date.getTime()) ? text : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}), timeZone: 'Asia/Kolkata' }).format(date);
}
export function PageHeader({ eyebrow = 'Bakery operations', title, description, children }) {
  return <header className="ow-page-header"><div className="ow-header-copy"><div className="ow-eyebrow"><span />{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div><Wheat className="ow-header-wheat" size={126} strokeWidth={.7} aria-hidden="true" /><div className="ow-header-actions">{children}</div></header>;
}
export function RefreshButton({ onClick, loading }) { return <button className="ow-button ow-button-light" onClick={onClick} disabled={loading} aria-label="Refresh data"><RefreshCw size={15} className={loading ? 'ow-spinning' : ''} /><span>Refresh</span></button>; }
export function StatusBadge({ value, tone }) {
  const lower = String(value || '').toLowerCase();
  const inferred = /reject|cancel|blocked|out of stock/.test(lower) ? 'danger' : /paid|deliver|complete|optimal|verified|dispatched/.test(lower) && !/unpaid/.test(lower) ? 'success' : /pending|production|baking|low stock|review/.test(lower) ? 'amber' : 'neutral';
  return <span className={`ow-badge ow-badge-${tone || inferred}`}><span />{value || 'Not set'}</span>;
}
export function MetricStrip({ items }) { const defaults = [Wallet, ShoppingBag, ChefHat, PackageCheck]; return <div className="ow-metric-strip">{items.map((item, index) => { const Icon = item.icon || defaults[index % defaults.length]; return <div className="ow-metric" key={item.label}><div className="ow-metric-heading"><span>{item.label}</span><span className="ow-metric-icon"><Icon size={19} strokeWidth={1.6} aria-hidden="true" /></span></div><strong>{item.value ?? '—'}</strong>{item.note && <small>{item.note}</small>}</div>; })}</div>; }
export function Notice({ children, error = false }) { return children ? <div className={`ow-notice ${error ? 'ow-notice-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div> : null; }
export function EmptyState({ title, children, action }) { return <div className="ow-empty"><div className="ow-empty-mark" aria-hidden="true"><Inbox size={23} strokeWidth={1.3} /></div><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>; }
export function SectionHeader({ title, subtitle, children }) { return <div className="ow-section-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>; }
export function TextLink({ href, children }) { return <a className="ow-text-link" href={href}>{children}<ArrowUpRight size={14} /></a>; }
export function Dialog({ title, description, onClose, children, footer, wide = false }) {
  const id = useId(), ref = useRef(null), closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('button, input, select, textarea')?.focus();
    const handler = event => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const nodes = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')].filter(node => node.getClientRects().length);
        if (!nodes.length) return;
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0].focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return createPortal(<div className="ow-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className={`ow-dialog ${wide ? 'ow-dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}><header><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div><button className="ow-icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></header><div className="ow-dialog-body">{children}</div>{footer && <footer>{footer}</footer>}</section></div>, document.body);
}
