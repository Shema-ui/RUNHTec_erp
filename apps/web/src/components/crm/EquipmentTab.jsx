import React, { useEffect, useState } from 'react';
import { Plus, X, Loader2, Check, ChevronDown, ChevronUp, Wrench, AlertTriangle } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS, EQUIPMENT_STATUSES } from '@/lib/crm';

const inputCls = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const selectCls = `h-9 ${inputCls}`;

function EquipmentCard({ eq, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const statusInfo = EQUIPMENT_STATUSES.find(s => s.value === eq.status) || EQUIPMENT_STATUSES[0];
  const condInfo = EQUIPMENT_CONDITIONS.find(c => c.value === eq.condition);
  const catInfo = EQUIPMENT_CATEGORIES.find(c => c.value === eq.category);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Wrench className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{eq.name}</p>
              <p className="text-xs text-muted-foreground">{eq.equipment_id || 'No ID'} — {catInfo?.label || eq.category || 'Uncategorised'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
              {condInfo && <span className={`text-xs font-medium ${condInfo.cls}`}>{condInfo.label}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setExpanded(v => !v)} className="rounded p-1 text-muted-foreground hover:bg-secondary">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={async () => { if (!confirm('Delete this equipment?')) return; setDeleting(true); await onDelete(eq.id); setDeleting(false); }}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border bg-secondary/20 px-4 py-3">
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            {[
              ['Brand', eq.brand], ['Manufacturer', eq.manufacturer], ['Model', eq.model_number],
              ['Serial No.', eq.serial_number], ['Capacity', eq.capacity], ['Voltage', eq.voltage],
              ['Power Rating', eq.power_rating], ['Location', eq.asset_location], ['Building', eq.building],
              ['Floor', eq.floor], ['Room', eq.room], ['Installed', eq.installation_date],
              ['Commissioned', eq.commissioning_date], ['Warranty Expiry', eq.warranty_expiry],
              ['Service Interval', eq.service_interval], ['Next Service', eq.next_service_date],
              ['Technician', eq.assigned_technician], ['GPS', eq.gps_coordinates],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <span className="font-medium text-muted-foreground">{k}: </span>
                <span className="text-foreground">{v}</span>
              </div>
            ))}
          </div>
          {eq.remarks && <p className="mt-2 text-xs text-muted-foreground italic">{eq.remarks}</p>}
        </div>
      )}
    </div>
  );
}

const BLANK = {
  equipment_id: '', name: '', category: '', manufacturer: '', brand: '', model_number: '',
  serial_number: '', capacity: '', voltage: '', power_rating: '', installation_date: '',
  warranty_expiry: '', commissioning_date: '', asset_location: '', building: '', floor: '',
  room: '', gps_coordinates: '', condition: '', status: 'operational', service_interval: '',
  next_service_date: '', assigned_technician: '', remarks: '',
};

export default function EquipmentTab({ clientId }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await pb.collection('equipment').getFullList({
        filter: `client = '${clientId}'`,
        sort: '-created',
        requestKey: `equip-${clientId}`,
      });
      setItems(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId]);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Equipment name is required'); return; }
    setSaving(true); setError('');
    try {
      // Generate equipment ID
      const year = new Date().getFullYear();
      const count = items.length;
      const eqId = `EQ-${year}-${String(count + 1).padStart(4, '0')}`;
      const payload = { ...form, client: clientId, equipment_id: form.equipment_id || eqId };
      // Remove empty optional fields
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = undefined; });
      await pb.collection('equipment').create(payload);
      setForm(BLANK);
      setShowForm(false);
      await load();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await pb.collection('equipment').delete(id);
    setItems(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading equipment…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} equipment record{items.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'Add Equipment'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">New Equipment Record</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Equipment ID', 'equipment_id', 'text', 'Auto-generated if empty'],
              ['Equipment Name *', 'name', 'text', 'e.g. HVAC Chiller Unit 1'],
              ['Manufacturer', 'manufacturer', 'text', 'e.g. Carrier'],
              ['Brand', 'brand', 'text', 'e.g. Carrier'],
              ['Model Number', 'model_number', 'text', ''],
              ['Serial Number', 'serial_number', 'text', ''],
              ['Capacity', 'capacity', 'text', 'e.g. 100kW'],
              ['Voltage', 'voltage', 'text', 'e.g. 380V 3-Phase'],
              ['Power Rating', 'power_rating', 'text', 'e.g. 75kW'],
              ['Asset Location', 'asset_location', 'text', 'e.g. Main Building Rooftop'],
              ['Building', 'building', 'text', ''],
              ['Floor', 'floor', 'text', ''],
              ['Room', 'room', 'text', ''],
              ['GPS Coordinates', 'gps_coordinates', 'text', '-25.7479, 28.2293'],
              ['Assigned Technician', 'assigned_technician', 'text', ''],
              ['Service Interval', 'service_interval', 'text', 'e.g. 6 months'],
            ].map(([label, key, type, placeholder]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
                <input
                  value={form[key]} onChange={e => set(key, e.target.value)}
                  type={type} placeholder={placeholder} className={inputCls}
                />
              </div>
            ))}
            {[
              ['Category', 'category', EQUIPMENT_CATEGORIES],
              ['Condition', 'condition', EQUIPMENT_CONDITIONS],
              ['Status', 'status', EQUIPMENT_STATUSES],
            ].map(([label, key, opts]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
                <select value={form[key]} onChange={e => set(key, e.target.value)} className={selectCls}>
                  <option value="">— Select —</option>
                  {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
            {[
              ['Installation Date', 'installation_date'],
              ['Commissioning Date', 'commissioning_date'],
              ['Warranty Expiry', 'warranty_expiry'],
              ['Next Service Date', 'next_service_date'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-foreground">{label}</label>
                <input type="date" value={form[key]} onChange={e => set(key, e.target.value)} className={inputCls} />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-foreground">Remarks</label>
              <textarea value={form.remarks} onChange={e => set('remarks', e.target.value)} rows={2} placeholder="Additional notes…" className={`w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring`} />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Equipment
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Wrench className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No equipment records yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Register all equipment installed or serviced at this client site.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(eq => <EquipmentCard key={eq.id} eq={eq} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  );
}
