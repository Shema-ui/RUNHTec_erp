// Small shared building blocks for ERP pages (forms, cards, pills, modals),
// so every module looks and behaves the same way.
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Loader2, Search } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export const inputCls = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/30';
export const textareaCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30';
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60';
export const btnLine = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60';
export const btnDanger = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-card px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60';

export function Field({ label, required, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Pill({ info, className = '' }) {
  if (!info) return null;
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.cls || 'bg-slate-100 text-slate-600'} ${className}`}>
      {info.label}
    </span>
  );
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ icon: Icon, label, value, note, tone = 'primary' }) {
  const tones = {
    primary: 'bg-accent text-primary',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {Icon && <div className={`rounded-xl p-3 ${tones[tone] || tones.primary}`}><Icon className="h-5 w-5" /></div>}
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-semibold text-foreground">{value}</p>
          {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
        </div>
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card p-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search' }) {
  return (
    <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none" />
    </div>
  );
}

export function FilterSelect({ value, onChange, options, allLabel }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none">
      <option value="all">{allLabel}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Toolbar({ children }) {
  return <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">{children}</div>;
}

export function BackLink({ to, children = 'Back' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">
      <ChevronLeft className="h-4 w-4" /> {children}
    </Link>
  );
}

export function Modal({ open, onClose, title, description, children, wide = false }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] overflow-y-auto ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function InfoRow({ label, children }) {
  if (children === undefined || children === null || children === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line text-sm text-foreground">{children}</span>
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 'h-4 w-4' }) {
  return (
    <div className="inline-flex items-center gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        onChange ? (
          <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n === value ? 0 : n)}
            className={`text-lg leading-none ${n <= value ? 'text-amber-500' : 'text-slate-300'} hover:text-amber-400`}>★</button>
        ) : (
          <span key={n} className={`${size} text-sm leading-none ${n <= Math.round(value) ? 'text-amber-500' : 'text-slate-300'}`}>★</span>
        )
      ))}
    </div>
  );
}

// Build a FormData body when a file is attached, plain JSON otherwise.
export function toBody(data, files = {}) {
  const hasFile = Object.values(files).some(Boolean);
  if (!hasFile) return data;
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
  Object.entries(files).forEach(([k, f]) => { if (f) fd.append(k, f); });
  return fd;
}

export const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
