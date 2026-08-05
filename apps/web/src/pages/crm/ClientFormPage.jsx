import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activity';
import PortalLayout from '@/layouts/PortalLayout';
import { CLIENT_STATUSES, CLIENT_CATEGORIES, CLIENT_SERVICES } from '@/lib/crm';

const schema = z.object({
  company_name: z.string().min(2, 'Company name is required'),
  trading_name: z.string().optional(),
  industry: z.string().optional(),
  registration_number: z.string().optional(),
  vat_number: z.string().optional(),
  website: z.string().optional(),
  status: z.string(),
  potential_value: z.string().optional(),
  country: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  sector: z.string().optional(),
  street: z.string().optional(),
  building_name: z.string().optional(),
  office_number_addr: z.string().optional(),
  gps_coordinates: z.string().optional(),
  account_manager: z.string().optional(),
});

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-display mb-4 border-b border-border pb-3 text-sm font-bold text-foreground">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, error, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

const inputCls = "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export default function ClientFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { status: 'lead' },
  });

  useEffect(() => {
    pb.collection('users').getFullList({ sort: 'name', requestKey: 'form-users' }).then(setUsers).catch(() => {});
    if (isEdit) {
      pb.collection('clients').getOne(id, { requestKey: 'form-client' }).then(c => {
        reset({
          company_name: c.company_name || '',
          trading_name: c.trading_name || '',
          industry: c.industry || '',
          registration_number: c.registration_number || '',
          vat_number: c.vat_number || '',
          website: c.website || '',
          status: c.status || 'lead',
          potential_value: c.potential_value ? String(c.potential_value) : '',
          country: c.country || '',
          province: c.province || '',
          district: c.district || '',
          city: c.city || '',
          sector: c.sector || '',
          street: c.street || '',
          building_name: c.building_name || '',
          office_number_addr: c.office_number_addr || '',
          gps_coordinates: c.gps_coordinates || '',
          account_manager: c.account_manager || '',
        });
        setSelectedCategories(Array.isArray(c.categories) ? c.categories : c.categories ? [c.categories] : []);
        setSelectedServices(Array.isArray(c.services) ? c.services : c.services ? [c.services] : []);
      }).catch(() => navigate('/crm/clients'));
    }
  }, [id]);

  const toggleMulti = (setter, current, value) => {
    setter(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  };

  const onSubmit = async (data) => {
    setSaving(true);
    setServerError('');
    try {
      const payload = {
        ...data,
        categories: selectedCategories,
        services: selectedServices,
        potential_value: data.potential_value ? Number(data.potential_value) : null,
      };
      if (!payload.website) delete payload.website;
      if (!payload.account_manager) delete payload.account_manager;

      let client;
      if (isEdit) {
        client = await pb.collection('clients').update(id, payload);
        logActivity('Client updated', `${client.company_name} profile updated`);
      } else {
        // Generate client ID
        const year = new Date().getFullYear();
        const count = await pb.collection('clients').getList(1, 1, { requestKey: 'client-count' });
        const num = String(count.totalItems + 1).padStart(4, '0');
        payload.client_id = `RHT-${year}-${num}`;
        client = await pb.collection('clients').create(payload);
        // Log activity
        await pb.collection('client_activities').create({
          client: client.id,
          type: 'other',
          description: 'Client profile created',
          actor: user?.id,
          actor_name: user?.name || user?.email,
        });
        logActivity('Client created', `New client: ${client.company_name}`);
      }
      navigate(`/crm/clients/${client.id}`);
    } catch (e) {
      console.error('save client error', e);
      setServerError(e.message || 'Failed to save client. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout title={isEdit ? 'Edit Client' : 'New Client'} subtitle="CRM — Client Database">
      <Helmet>
        <title>{isEdit ? 'Edit Client' : 'New Client'} | RUNHTec CRM</title>
        <meta name="description" content="Add or edit a client record in the RUNHTec CRM." />
      </Helmet>

      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="font-display text-lg font-bold text-foreground">{isEdit ? 'Edit Client' : 'New Client'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Company Information */}
        <Section title="Company Information">
          <Field label="Company Name" required error={errors.company_name?.message}>
            <input {...register('company_name')} placeholder="e.g. Meridian Facilities (Pty) Ltd" className={inputCls} />
          </Field>
          <Field label="Trading Name" error={errors.trading_name?.message}>
            <input {...register('trading_name')} placeholder="Trading as (if different)" className={inputCls} />
          </Field>
          <Field label="Industry" error={errors.industry?.message}>
            <input {...register('industry')} placeholder="e.g. Construction, Healthcare" className={inputCls} />
          </Field>
          <Field label="Client Status" error={errors.status?.message}>
            <select {...register('status')} className={inputCls}>
              {CLIENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Company Registration Number">
            <input {...register('registration_number')} placeholder="e.g. 2010/123456/07" className={inputCls} />
          </Field>
          <Field label="Tax / VAT Number">
            <input {...register('vat_number')} placeholder="e.g. 4123456789" className={inputCls} />
          </Field>
          <Field label="Website">
            <input {...register('website')} placeholder="https://example.com" className={inputCls} />
          </Field>
          <Field label="Potential Sales Value (R)">
            <input {...register('potential_value')} type="number" min="0" placeholder="0" className={inputCls} />
          </Field>
          <Field label="Account Manager" className="sm:col-span-2">
            <select {...register('account_manager')} className={inputCls}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </Field>
        </Section>

        {/* Address Information */}
        <Section title="Address Information">
          <Field label="Country">
            <input {...register('country')} placeholder="e.g. South Africa" className={inputCls} />
          </Field>
          <Field label="Province / State">
            <input {...register('province')} placeholder="e.g. Gauteng" className={inputCls} />
          </Field>
          <Field label="District">
            <input {...register('district')} placeholder="e.g. City of Tshwane" className={inputCls} />
          </Field>
          <Field label="City / Town">
            <input {...register('city')} placeholder="e.g. Pretoria" className={inputCls} />
          </Field>
          <Field label="Suburb / Sector">
            <input {...register('sector')} placeholder="e.g. Hatfield" className={inputCls} />
          </Field>
          <Field label="Street Address">
            <input {...register('street')} placeholder="e.g. 123 Main Street" className={inputCls} />
          </Field>
          <Field label="Building Name">
            <input {...register('building_name')} placeholder="e.g. Waterfall Corporate Park" className={inputCls} />
          </Field>
          <Field label="Office Number">
            <input {...register('office_number_addr')} placeholder="e.g. Suite 12B, Floor 3" className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="GPS Coordinates">
              <input {...register('gps_coordinates')} placeholder="-25.7479, 28.2293" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Client Classification */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-4 border-b border-border pb-3 text-sm font-bold text-foreground">Client Classification</h3>
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-foreground">Categories (select all that apply)</p>
            <div className="flex flex-wrap gap-2">
              {CLIENT_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => toggleMulti(setSelectedCategories, selectedCategories, cat.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCategories.includes(cat.value)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Services Required (select all that apply)</p>
            <div className="flex flex-wrap gap-2">
              {CLIENT_SERVICES.map(svc => (
                <button
                  key={svc.value}
                  type="button"
                  onClick={() => toggleMulti(setSelectedServices, selectedServices, svc.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedServices.includes(svc.value)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {svc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </form>
    </PortalLayout>
  );
}
