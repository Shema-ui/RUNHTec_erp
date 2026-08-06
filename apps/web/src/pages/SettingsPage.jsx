import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Save, Loader2, Building2, CreditCard, Info, PenLine, Upload, X, Image as ImageIcon, Stamp, FileText } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import PortalLayout from '@/layouts/PortalLayout';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const inputCls = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-colors';
const textareaCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none';

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      {hint && <p className="mb-1.5 text-[11px] text-muted-foreground/70">{hint}</p>}
      {children}
    </div>
  );
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
        </div>
        {description && <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Shared upload control used for logo / signature / stamp — keeps the three
// nearly-identical blocks from drifting out of sync.
function ImageUploadControl({ label, hint, previewSrc, hasExisting, isSuperAdmin, onSelect, onRemove, aspect = 'wide' }) {
  const inputRef = useRef(null);
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className={`flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-slate-50 ${aspect === 'square' ? 'h-28 w-28' : 'h-28 w-56'}`}>
          {previewSrc ? (
            <img src={previewSrc} alt={`${label} preview`} className="max-h-24 max-w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">No {label.toLowerCase()} uploaded</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">Current {label.toLowerCase()} preview</span>
      </div>
      {isSuperAdmin && (
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={e => { if (e.target.files[0]) onSelect(e.target.files[0]); }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            {hasExisting ? `Replace ${label}` : `Upload ${label}`}
          </button>
          {hasExisting && (
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
              Remove {label}
            </button>
          )}
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      )}
    </div>
  );
}

const DEFAULT_TERMS = `1. Payment is due within the stated payment terms from the invoice date.
2. Late payments may incur interest charges at the applicable rate.
3. All prices are in the stated currency and exclusive of VAT unless otherwise indicated.
4. RUNHTec Contractors reserves the right to suspend services for overdue accounts.
5. Disputes must be raised in writing within 7 days of invoice receipt.`;

const DEFAULT_PAYMENT_INSTRUCTIONS = `Please use the invoice number as the payment reference.\nEFT payments to the bank account details below.\nFor queries, contact accounts@runhteccontractors.com`;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState(null);
  const isSuperAdmin = user?.role === 'super_admin';

  // Image assets: { url, file, remove } per asset
  const [logo, setLogo] = useState({ url: null, file: null, remove: false });
  const [signature, setSignature] = useState({ url: null, file: null, remove: false });
  const [stamp, setStamp] = useState({ url: null, file: null, remove: false });

  const [form, setForm] = useState({
    company_name: 'RUNHTec Contractors',
    company_tagline: '',
    company_registration_number: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    branch_code: '',
    swift_code: '',
    currency: 'ZAR',
    signature_name: '',
    signature_position: '',
    show_signature: true,
    show_stamp: true,
    invoice_footer_text: 'Thank you for your business.',
    default_terms_conditions: DEFAULT_TERMS,
    default_payment_instructions: DEFAULT_PAYMENT_INSTRUCTIONS,
  });

  useEffect(() => {
    pb.collection('company_settings').getList(1, 1, { requestKey: 'settings-load' })
      .then(r => {
        if (r.items.length > 0) {
          const rec = r.items[0];
          setRecordId(rec.id);
          setForm(prev => ({
            ...prev,
            company_name: rec.company_name || 'RUNHTec Contractors',
            company_tagline: rec.company_tagline || '',
            company_registration_number: rec.company_registration_number || '',
            company_address: rec.company_address || '',
            company_phone: rec.company_phone || '',
            company_email: rec.company_email || '',
            company_website: rec.company_website || '',
            bank_name: rec.bank_name || '',
            account_name: rec.account_name || '',
            account_number: rec.account_number || '',
            branch_code: rec.branch_code || '',
            swift_code: rec.swift_code || '',
            currency: rec.currency || 'ZAR',
            signature_name: rec.signature_name || '',
            signature_position: rec.signature_position || '',
            show_signature: rec.show_signature !== false,
            show_stamp: rec.show_stamp !== false,
            invoice_footer_text: rec.invoice_footer_text || 'Thank you for your business.',
            default_terms_conditions: rec.default_terms_conditions || DEFAULT_TERMS,
            default_payment_instructions: rec.default_payment_instructions || DEFAULT_PAYMENT_INSTRUCTIONS,
          }));
          if (rec.logo) setLogo(p => ({ ...p, url: pb.files.getURL(rec, rec.logo) }));
          if (rec.signature) setSignature(p => ({ ...p, url: pb.files.getURL(rec, rec.signature) }));
          if (rec.stamp) setStamp(p => ({ ...p, url: pb.files.getURL(rec, rec.stamp) }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, typeof v === 'boolean' ? String(v) : v));

      const assets = [['logo', logo], ['signature', signature], ['stamp', stamp]];
      assets.forEach(([key, asset]) => {
        if (asset.file) fd.append(key, asset.file);
        else if (asset.remove) fd.append(key, '');
      });

      let rec;
      if (recordId) {
        rec = await pb.collection('company_settings').update(recordId, fd);
      } else {
        rec = await pb.collection('company_settings').create(fd);
        setRecordId(rec.id);
      }

      setLogo({ url: rec.logo ? pb.files.getURL(rec, rec.logo) : null, file: null, remove: false });
      setSignature({ url: rec.signature ? pb.files.getURL(rec, rec.signature) : null, file: null, remove: false });
      setStamp({ url: rec.stamp ? pb.files.getURL(rec, rec.stamp) : null, file: null, remove: false });

      toast({ title: 'Settings saved', description: 'Company and invoice branding updated successfully.' });
    } catch (e) {
      toast({ title: 'Error saving settings', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout title="Settings" subtitle="Company Information">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Settings" subtitle="Company Information & Invoice Branding">
      <Helmet>
        <title>Settings | RUNHTec Business Portal</title>
        <meta name="description" content="Manage company information, payment details, and invoice branding for RUNHTec Business Portal." />
      </Helmet>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          These details appear on every generated invoice. Update them here to reflect on future invoices automatically.
        </p>
        {isSuperAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
        )}
      </div>

      {!isSuperAdmin && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>These settings are read-only for your role. Contact a Super Administrator to make changes.</span>
        </div>
      )}

      <div className="space-y-5">
        <SectionCard icon={Building2} title="Company Information" description="Legal identity and contact details shown in the invoice header and footer.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company Name">
              <input
                className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="RUNHTec Contractors"
                value={form.company_name}
                onChange={e => isSuperAdmin && setField('company_name', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
            <Field label="Tagline" hint="Shown under the company name on the invoice header.">
              <input
                className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="e.g. Engineering. Delivered."
                value={form.company_tagline}
                onChange={e => isSuperAdmin && setField('company_tagline', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
            <Field label="Company Address" className="sm:col-span-2">
              <textarea
                className={`${textareaCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                rows={2}
                placeholder="Street, City, Province / State, Country"
                value={form.company_address}
                onChange={e => isSuperAdmin && setField('company_address', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
            <Field label="Phone Number">
              <input
                className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="+27 XX XXX XXXX"
                value={form.company_phone}
                onChange={e => isSuperAdmin && setField('company_phone', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
            <Field label="Email Address">
              <input
                className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                type="email"
                placeholder="info@runhteccontractors.com"
                value={form.company_email}
                onChange={e => isSuperAdmin && setField('company_email', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
            <Field label="Website">
              <input
                className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="www.runhteccontractors.com"
                value={form.company_website}
                onChange={e => isSuperAdmin && setField('company_website', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
            <Field label="Registration / TIN Number" hint="Shown in the invoice footer for compliance.">
              <input
                className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="e.g. RDB/TIN 1234567890"
                value={form.company_registration_number}
                onChange={e => isSuperAdmin && setField('company_registration_number', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard icon={ImageIcon} title="Company Logo" description="Appears in the top-left of the invoice header. Transparent PNG or SVG recommended.">
          <ImageUploadControl
            label="Logo"
            hint="Square or wide logo. Max 2 MB."
            previewSrc={logo.file ? URL.createObjectURL(logo.file) : (!logo.remove && logo.url)}
            hasExisting={Boolean(logo.url || logo.file) && !logo.remove}
            isSuperAdmin={isSuperAdmin}
            aspect="square"
            onSelect={(file) => setLogo({ url: logo.url, file, remove: false })}
            onRemove={() => setLogo({ url: null, file: null, remove: true })}
          />
        </SectionCard>

        <SectionCard icon={CreditCard} title="Payment / Banking Details" description="These bank details appear on every invoice. Ensure accuracy before saving.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: 'bank_name', label: 'Bank Name', placeholder: 'e.g. First National Bank' },
              { key: 'account_name', label: 'Account Name', placeholder: 'Registered account name' },
              { key: 'account_number', label: 'Account Number', placeholder: 'Bank account number' },
              { key: 'branch_code', label: 'Branch / Sort Code', placeholder: 'e.g. 250655' },
              { key: 'swift_code', label: 'SWIFT / BIC Code', placeholder: 'e.g. FIRNZAJJ' },
              { key: 'currency', label: 'Default Currency', placeholder: 'ZAR' },
            ].map(f => (
              <Field key={f.key} label={f.label}>
                {f.key === 'currency' ? (
                  <select
                    className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                    value={form.currency}
                    onChange={e => isSuperAdmin && setField('currency', e.target.value)}
                    disabled={!isSuperAdmin}
                  >
                    <option value="ZAR">ZAR — South African Rand</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="RWF">RWF — Rwandan Franc</option>
                    <option value="KES">KES — Kenyan Shilling</option>
                  </select>
                ) : (
                  <input
                    className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => isSuperAdmin && setField(f.key, e.target.value)}
                    readOnly={!isSuperAdmin}
                  />
                )}
              </Field>
            ))}
          </div>
        </SectionCard>

        {/* Digital Authorization: signature + stamp, stored once, reused automatically */}
        <SectionCard icon={PenLine} title="Digital Authorization" description="Upload once — the signature and stamp are applied automatically to every invoice. No manual signing required.">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Signee Name" hint="Printed under the signature on invoices.">
                <input
                  className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="e.g. Jean Baptiste Habimana"
                  value={form.signature_name}
                  onChange={e => isSuperAdmin && setField('signature_name', e.target.value)}
                  readOnly={!isSuperAdmin}
                />
              </Field>
              <Field label="Signee Position" hint="Printed under the name on invoices.">
                <input
                  className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="e.g. Managing Director"
                  value={form.signature_position}
                  onChange={e => isSuperAdmin && setField('signature_position', e.target.value)}
                  readOnly={!isSuperAdmin}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-slate-50 px-4 py-3">
              <label className={`flex items-center gap-2 text-sm font-medium ${!isSuperAdmin ? 'opacity-70' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={form.show_signature}
                  disabled={!isSuperAdmin}
                  onChange={e => setField('show_signature', e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Show signature on invoices
              </label>
              <label className={`flex items-center gap-2 text-sm font-medium ${!isSuperAdmin ? 'opacity-70' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={form.show_stamp}
                  disabled={!isSuperAdmin}
                  onChange={e => setField('show_stamp', e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Show company stamp on invoices
              </label>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signature Image</p>
              <ImageUploadControl
                label="Signature"
                hint="PNG with transparent background recommended. Max 2 MB."
                previewSrc={signature.file ? URL.createObjectURL(signature.file) : (!signature.remove && signature.url)}
                hasExisting={Boolean(signature.url || signature.file) && !signature.remove}
                isSuperAdmin={isSuperAdmin}
                onSelect={(file) => setSignature({ url: signature.url, file, remove: false })}
                onRemove={() => setSignature({ url: null, file: null, remove: true })}
              />
            </div>

            <div>
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Stamp className="h-3.5 w-3.5" /> Company Stamp / Seal
              </p>
              <ImageUploadControl
                label="Stamp"
                hint="PNG with transparent background recommended. Max 2 MB."
                previewSrc={stamp.file ? URL.createObjectURL(stamp.file) : (!stamp.remove && stamp.url)}
                hasExisting={Boolean(stamp.url || stamp.file) && !stamp.remove}
                isSuperAdmin={isSuperAdmin}
                aspect="square"
                onSelect={(file) => setStamp({ url: stamp.url, file, remove: false })}
                onRemove={() => setStamp({ url: null, file: null, remove: true })}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={FileText} title="Invoice Defaults" description="Applied to every new invoice and the invoice footer. Editable per-invoice afterwards if needed.">
          <div className="grid grid-cols-1 gap-5">
            <Field label="Invoice Footer Message" hint="Short thank-you or closing line shown at the bottom of every invoice.">
              <input
                className={`${inputCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="Thank you for your business."
                value={form.invoice_footer_text}
                onChange={e => isSuperAdmin && setField('invoice_footer_text', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
            <Field label="Default Payment Instructions">
              <textarea
                className={`${textareaCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                rows={4}
                value={form.default_payment_instructions}
                onChange={e => isSuperAdmin && setField('default_payment_instructions', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
            <Field label="Default Terms &amp; Conditions">
              <textarea
                className={`${textareaCls} ${!isSuperAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
                rows={5}
                value={form.default_terms_conditions}
                onChange={e => isSuperAdmin && setField('default_terms_conditions', e.target.value)}
                readOnly={!isSuperAdmin}
              />
            </Field>
          </div>
        </SectionCard>

        {isSuperAdmin && (
          <div className="flex justify-end pb-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </button>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
