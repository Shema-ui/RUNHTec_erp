import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, Save } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Field, inputCls, textareaCls, btnPrimary } from '@/components/erp/kit';

// Orvio's branding and bank details, used on its quotes and invoices.
const FIELDS = [
  { key: 'company_name', label: 'Business name' },
  { key: 'company_tagline', label: 'Tagline' },
  { key: 'company_address', label: 'Address', textarea: true },
  { key: 'company_phone', label: 'Phone' },
  { key: 'company_email', label: 'Email' },
  { key: 'company_website', label: 'Website' },
  { key: 'company_registration_number', label: 'Registration / TIN' },
  { key: 'bank_name', label: 'Bank name' },
  { key: 'account_name', label: 'Account name' },
  { key: 'account_number', label: 'Account number' },
  { key: 'branch_code', label: 'Branch code' },
  { key: 'swift_code', label: 'SWIFT code' },
  { key: 'currency', label: 'Currency' },
  { key: 'invoice_footer_text', label: 'Invoice footer text', textarea: true },
  { key: 'default_terms_conditions', label: 'Default terms & conditions', textarea: true },
  { key: 'default_payment_instructions', label: 'Default payment instructions', textarea: true },
];

export default function OrvioProfilePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    pb.collection('business_profiles').getFullList({ requestKey: 'orvio-profile' })
      .then((list) => {
        const rec = list.find((p) => p.code === 'orvio') || null;
        setRecord(rec);
        if (rec) {
          setForm(Object.fromEntries(FIELDS.map((f) => [f.key, rec[f.key] || ''])));
          if (rec.logo) setLogoUrl(pb.files.getURL(rec, rec.logo));
        }
      })
      .catch(() => toast({ title: 'Could not load the Orvio profile', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('code', 'orvio');
      FIELDS.forEach((f) => fd.append(f.key, form[f.key] || ''));
      if (logoFile) fd.append('logo', logoFile);
      const rec = record
        ? await pb.collection('business_profiles').update(record.id, fd)
        : await pb.collection('business_profiles').create(fd);
      setRecord(rec);
      setLogoFile(null);
      if (rec.logo) setLogoUrl(pb.files.getURL(rec, rec.logo));
      toast({ title: 'Orvio profile saved', description: 'New Orvio quotes and invoices will use these details.' });
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout title="Orvio profile" subtitle="Loading">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Orvio profile" subtitle="How Orvio appears on its quotes and invoices">
      <Helmet>
        <title>Orvio profile | RUNHTec Business Portal</title>
      </Helmet>

      <div className="mb-6 flex justify-end">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Orvio profile
        </button>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm md:grid-cols-2">
        <div className="flex items-center gap-4 md:col-span-2">
          {logoUrl
            ? <img src={logoUrl} alt="Orvio logo" className="h-16 max-w-[180px] object-contain" />
            : <div className="text-sm text-muted-foreground">No logo yet</div>}
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="text-sm" />
        </div>
        {FIELDS.map((f) => (
          <div key={f.key} className={f.textarea ? 'md:col-span-2' : ''}>
            <Field label={f.label}>
              {f.textarea
                ? <textarea rows={3} className={textareaCls} value={form[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} />
                : <input className={inputCls} value={form[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} />}
            </Field>
          </div>
        ))}
      </div>
    </PortalLayout>
  );
}
