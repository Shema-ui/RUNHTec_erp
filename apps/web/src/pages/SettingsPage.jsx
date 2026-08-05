import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Save, Loader2, Settings2, Building2, CreditCard, Info, PenLine, Upload, X } from 'lucide-react';
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

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [removeSig, setRemoveSig] = useState(false);
  const sigInputRef = useRef(null);
  const isSuperAdmin = user?.role === 'super_admin';

  const [form, setForm] = useState({
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
  });

  useEffect(() => {
    pb.collection('company_settings').getList(1, 1, { requestKey: 'settings-load' })
      .then(r => {
        if (r.items.length > 0) {
          const rec = r.items[0];
          setRecordId(rec.id);
          setForm({
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
          });
          if (rec.signature) {
            setSignatureUrl(pb.files.getURL(rec, rec.signature));
          }
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
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (signatureFile) {
        fd.append('signature', signatureFile);
      } else if (removeSig) {
        fd.append('signature', '');
      }
      let rec;
      if (recordId) {
        rec = await pb.collection('company_settings').update(recordId, fd);
      } else {
        rec = await pb.collection('company_settings').create(fd);
        setRecordId(rec.id);
      }
      if (rec.signature) {
        setSignatureUrl(pb.files.getURL(rec, rec.signature));
      } else {
        setSignatureUrl(null);
      }
      setSignatureFile(null);
      setRemoveSig(false);
      toast({ title: 'Settings saved', description: 'Company and payment details updated successfully.' });
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
    <PortalLayout title="Settings" subtitle="Company Information & Payment Details">
      <Helmet>
        <title>Settings | RUNHTec Business Portal</title>
        <meta name="description" content="Manage company information and payment details for RUNHTec Business Portal." />
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
        <SectionCard icon={Building2} title="Company Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
        </SectionCard>

        <SectionCard icon={CreditCard} title="Payment / Banking Details">
          <p className="mb-4 text-xs text-muted-foreground">
            These bank details will appear on every invoice. Ensure accuracy before saving.
          </p>
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

        {/* Signature Section */}
        <SectionCard icon={PenLine} title="Digital Signature">
          <p className="mb-4 text-xs text-muted-foreground">
            Upload a signature image (PNG with transparent background recommended). It will automatically appear on all invoices and quotes.
          </p>
          <div className="flex flex-wrap items-start gap-6">
            {/* Preview */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-28 w-56 items-center justify-center rounded-lg border-2 border-dashed border-border bg-slate-50">
                {(signatureFile ? URL.createObjectURL(signatureFile) : (!removeSig && signatureUrl)) ? (
                  <img
                    src={signatureFile ? URL.createObjectURL(signatureFile) : signatureUrl}
                    alt="Signature preview"
                    className="max-h-24 max-w-48 object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No signature uploaded</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">Current signature preview</span>
            </div>
            {/* Controls */}
            {isSuperAdmin && (
              <div className="flex flex-col gap-2">
                <input
                  ref={sigInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files[0]) { setSignatureFile(e.target.files[0]); setRemoveSig(false); }
                  }}
                />
                <button
                  type="button"
                  onClick={() => sigInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  {signatureUrl || signatureFile ? 'Replace Signature' : 'Upload Signature'}
                </button>
                {(signatureUrl || signatureFile) && !removeSig && (
                  <button
                    type="button"
                    onClick={() => { setRemoveSig(true); setSignatureFile(null); }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                    Remove Signature
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground">
                  PNG with transparent background recommended.<br />Max 2 MB. Appears bottom-right of all invoices.
                </p>
              </div>
            )}
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
