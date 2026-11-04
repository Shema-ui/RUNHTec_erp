import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus, Rows3, Phone, Mail, MapPin, User, Truck, Trash2 } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BackLink, Card, Empty, Loading, SearchBox, btnPrimary, btnLine, btnDanger, InfoRow } from '@/components/erp/kit';
import PrivateLinkCard from '@/components/erp/PrivateLinkCard';
import VendorItemsTable from '@/components/erp/VendorItemsTable';
import { VendorItemDialog, VendorBulkDialog } from '@/components/erp/VendorItemDialogs';
import VendorFormDialog from './VendorFormDialog';

// Staff view of one vendor: details, their access link and their price list.
export default function VendorDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [v, setV] = useState(null);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [editVendor, setEditVendor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState(false);

  const load = () => Promise.all([
    pb.collection('vendors').getOne(id),
    pb.collection('vendor_items').getFullList({ filter: `vendor = '${id.replace(/'/g, '')}'`, sort: 'name' }),
  ]).then(([vv, ii]) => { setV(vv); setItems(ii); }).catch(() => setV(false));
  useEffect(() => { load(); }, [id]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((it) => [it.name, it.brand, it.code].join(' ').toLowerCase().includes(t)) : items;
  }, [items, q]);

  const patch = async (itemId, body) => {
    try {
      const r = await pb.collection('vendor_items').update(itemId, body);
      setItems((l) => l.map((x) => (x.id === itemId ? r : x)));
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); throw e; }
  };
  const saveOne = async (f) => {
    const { id: _ignore, ...data } = f;
    if (editing?.id) await patch(editing.id, data);
    else { await pb.collection('vendor_items').create({ ...data, vendor: id }); await load(); }
  };
  const saveMany = async (list) => {
    for (const it of list) await pb.collection('vendor_items').create({ ...it, vendor: id });
    await load();
    toast({ title: `${list.length} item${list.length === 1 ? '' : 's'} added` });
  };
  const removeItem = async (it) => {
    if (!window.confirm(`Remove “${it.name}” from ${v.name}'s price list?`)) return;
    try { await pb.collection('vendor_items').delete(it.id); setItems((l) => l.filter((x) => x.id !== it.id)); }
    catch (e) { toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }); }
  };
  const removeVendor = async () => {
    if (!window.confirm(`Delete ${v.name}, their whole price list and their access link? This cannot be undone.`)) return;
    try { await pb.collection('vendors').delete(v.id); toast({ title: 'Vendor deleted' }); navigate('/vendors'); }
    catch (e) { toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }); }
  };

  if (v === false) return <PortalLayout title="Vendor"><Empty>This vendor was not found.</Empty></PortalLayout>;
  if (!v) return <PortalLayout title="Vendor"><Loading /></PortalLayout>;

  return (
    <PortalLayout title={v.name} subtitle="Vendor (supplier)">
      <Helmet><title>{v.name} | Vendors | RUNHTec Business Portal</title></Helmet>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <BackLink to="/vendors">All vendors</BackLink>
        <div className="flex gap-2">
          <button className={btnLine} onClick={() => setEditVendor(true)}><Pencil className="h-4 w-4" /> Edit vendor</button>
          {user?.role === 'super_admin' && <button className={btnDanger} onClick={removeVendor}><Trash2 className="h-4 w-4" /> Delete</button>}
        </div>
      </div>

      <PrivateLinkCard
        api="/api/vendor" field="vendor" id={v.id} name={v.name} path="/v/" icon={Truck}
        title="Vendor access"
        description="A private link where this vendor adds and updates their own items and prices. They type only their name, no password, and see nothing else in the ERP."
        shareText={(link) => `Hello, this is RUNHTec Contractors. Please add the items you supply and your prices here, and update them when prices change: ${link}\nJust open the link and type your name. Please keep it private.`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title={`Price list (${items.length})`} action={<div className="flex gap-2"><button className={btnLine} onClick={() => setBulk(true)}><Rows3 className="h-4 w-4" /> Add several</button><button className={btnPrimary} onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add item</button></div>}>
          {items.length > 5 && <div className="mb-3"><SearchBox value={q} onChange={setQ} placeholder="Search this price list" /></div>}
          {items.length === 0 ? <p className="text-sm text-muted-foreground">No items yet. Send the vendor their access link above so they add their prices, or add them yourself.</p>
            : shown.length === 0 ? <p className="text-sm text-muted-foreground">No item matches “{q}”.</p>
            : <VendorItemsTable items={shown} onPatch={patch} onEdit={setEditing} onDelete={removeItem} showChange />}
        </Card>
        <Card title="Details">
          <div className="space-y-3">
            <InfoRow label="Contact">{v.contact_name ? <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{v.contact_name}</span> : ''}</InfoRow>
            <InfoRow label="Phone">{v.phone ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${v.phone}`}><Phone className="h-3.5 w-3.5" />{v.phone}</a> : ''}</InfoRow>
            <InfoRow label="Email">{v.email ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${v.email}`}><Mail className="h-3.5 w-3.5" />{v.email}</a> : ''}</InfoRow>
            <InfoRow label="Address">{v.address ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{v.address}</span> : ''}</InfoRow>
            <InfoRow label="Supplies">{v.supplies}</InfoRow>
            <InfoRow label="Status">{v.status === 'inactive' ? 'Not used any more' : 'Active'}</InfoRow>
            <InfoRow label="Internal notes">{v.notes}</InfoRow>
          </div>
        </Card>
      </div>

      <VendorFormDialog open={editVendor} onClose={() => setEditVendor(false)} vendor={v} onSaved={setV} />
      <VendorItemDialog open={Boolean(editing)} onClose={() => setEditing(null)} item={editing?.id ? editing : null} currency={v.currency || 'RWF'} onSave={saveOne} />
      <VendorBulkDialog open={bulk} onClose={() => setBulk(false)} currency={v.currency || 'RWF'} onSave={saveMany} />
    </PortalLayout>
  );
}
