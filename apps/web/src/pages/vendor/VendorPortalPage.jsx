import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Rows3, Loader2, PackageOpen, Lock, Save, Clock, Boxes, AlertTriangle, KeyRound } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import BrandMark from '@/components/BrandMark';
import { Field, Modal, inputCls, textareaCls, btnPrimary, btnLine, SearchBox, fmtDate } from '@/components/erp/kit';
import VendorItemsTable from '@/components/erp/VendorItemsTable';
import { VendorItemDialog, VendorBulkDialog } from '@/components/erp/VendorItemDialogs';

// What a vendor (supplier) sees after opening their private link: only their
// own price list and contact details.
export default function VendorPortalPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // item, or {} for new
  const [bulk, setBulk] = useState(false);
  const [details, setDetails] = useState(null);
  const [savingDetails, setSavingDetails] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  // Signed out after 12 hours: back to the link page.
  const expired = (e) => { if (e?.status === 401) { logout(); navigate('/v/expired', { replace: true }); return true; } return false; };
  const load = () => pb.get('/api/vendor/me').then((d) => { setData(d); setDetails((p) => p || d.vendor); }).catch((e) => { if (!expired(e)) setError(e.message); });
  useEffect(() => { load(); }, []);

  const items = data?.items || [];
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((it) => [it.name, it.brand, it.code].join(' ').toLowerCase().includes(t)) : items;
  }, [items, q]);
  const lastUpdate = items.reduce((m, it) => (String(it.updated || '') > m ? String(it.updated) : m), '');
  const out = items.filter((it) => it.availability === 'out_of_stock').length;
  const currency = data?.vendor?.currency || 'RWF';

  const patch = async (id, body) => {
    const r = await pb.patch(`/api/vendor/items/${id}`, body).catch((e) => { expired(e); throw e; });
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === id ? { ...x, ...r } : x)) }));
  };
  const saveOne = async (f) => {
    if (editing?.id) await patch(editing.id, f);
    else { await pb.post('/api/vendor/items', f); await load(); }
    toast({ title: editing?.id ? 'Item updated' : 'Item added' });
  };
  const saveMany = async (list) => {
    await pb.post('/api/vendor/items', { items: list });
    await load();
    toast({ title: `${list.length} item${list.length === 1 ? '' : 's'} added` });
  };
  const remove = async (it) => {
    if (!window.confirm(`Remove “${it.name}” from your price list?`)) return;
    try { await pb.del(`/api/vendor/items/${it.id}`); setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== it.id) })); toast({ title: 'Item removed' }); }
    catch (e) { toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }); }
  };
  const saveDetails = async () => {
    setSavingDetails(true);
    try { await pb.patch('/api/vendor/me', details); toast({ title: 'Your details are saved' }); }
    catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setSavingDetails(false); }
  };
  const leave = () => { navigate('/v/bye', { replace: true }); setTimeout(logout, 0); };
  const first = String(user?.name || '').split(' ')[0];

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <Helmet><title>Your price list | RUNHTec supplier portal</title><meta name="robots" content="noindex" /></Helmet>
      <header className="sticky top-0 z-30 bg-[#003DA5] text-white shadow">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <BrandMark />
          <span className="hidden rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold sm:inline">Supplier portal</span>
          <button onClick={() => setPwOpen(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10" aria-label="Change password"><KeyRound className="h-4 w-4" /> <span className="hidden sm:inline">Password</span></button>
          <button onClick={leave} className=" inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/85 hover:bg-white/10" aria-label="Leave the supplier portal"><LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Leave</span></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:py-8">
        {error ? <p className="rounded-2xl bg-rose-50 p-6 text-center text-sm text-rose-700">{error}</p> : !data ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-[#003DA5]" /></div>
        ) : (
          <>
            <section className="rounded-3xl bg-gradient-to-br from-[#003DA5] to-[#0a2a6b] p-6 text-white shadow-lg sm:p-8">
              <p className="text-sm text-white/70">Hello{first ? ` ${first}` : ''} 👋</p>
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{data.vendor.name}</h1>
              <p className="mt-1 text-sm text-white/75">Your price list for RUNHTec Contractors. Keep it up to date so we order from you at the right price.</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/10 p-3"><Boxes className="h-5 w-5 text-white/70" /><p className="mt-1 font-display text-2xl font-bold">{items.length}</p><p className="text-[11px] text-white/70">Items</p></div>
                <div className="rounded-2xl bg-white/10 p-3"><Clock className="h-5 w-5 text-white/70" /><p className="mt-1 font-display text-base font-bold sm:text-xl">{lastUpdate ? fmtDate(lastUpdate) : '—'}</p><p className="text-[11px] text-white/70">Last update</p></div>
                <div className="rounded-2xl bg-white/10 p-3"><AlertTriangle className="h-5 w-5 text-white/70" /><p className="mt-1 font-display text-2xl font-bold">{out}</p><p className="text-[11px] text-white/70">Out of stock</p></div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="mr-auto font-display text-lg font-bold">Your items and prices</h2>
                <button className={btnLine} onClick={() => setBulk(true)}><Rows3 className="h-4 w-4" /> Add several</button>
                <button className={btnPrimary} onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add an item</button>
              </div>
              {items.length > 5 && <div className="mb-4"><SearchBox value={q} onChange={setQ} placeholder="Search your items" /></div>}
              {items.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
                  <PackageOpen className="h-10 w-10 text-slate-300" />
                  <p className="mt-3 font-medium">Your price list is empty</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">Add the items you supply with your price. You can add them one by one, type several rows, or paste a list from Excel.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button className={btnPrimary} onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add an item</button>
                    <button className={btnLine} onClick={() => setBulk(true)}><Rows3 className="h-4 w-4" /> Add several</button>
                  </div>
                </div>
              ) : shown.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No item matches “{q}”.</p> : (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">Tip: change a price right in the list, it saves by itself.</p>
                  <VendorItemsTable items={shown} onPatch={(id, b) => patch(id, b).catch((e) => { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); throw e; })} onEdit={setEditing} onDelete={remove} />
                </>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-display text-base font-bold">Your contact details</h2>
                {details && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Contact person"><input className={inputCls} value={details.contact_name || ''} onChange={(e) => setDetails((d) => ({ ...d, contact_name: e.target.value }))} /></Field>
                      <Field label="Phone / WhatsApp"><input className={inputCls} value={details.phone || ''} onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))} placeholder="+250 7XX XXX XXX" /></Field>
                      <Field label="Email"><input className={inputCls} type="email" value={details.email || ''} onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))} /></Field>
                      <Field label="Shop / office address"><input className={inputCls} value={details.address || ''} onChange={(e) => setDetails((d) => ({ ...d, address: e.target.value }))} /></Field>
                    </div>
                    <Field label="What you supply"><textarea className={textareaCls} rows={2} value={details.supplies || ''} onChange={(e) => setDetails((d) => ({ ...d, supplies: e.target.value }))} placeholder="e.g. Solar panels, inverters, batteries, cables" /></Field>
                    <div className="flex justify-end"><button className={btnPrimary} onClick={saveDetails} disabled={savingDetails}>{savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save details</button></div>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-white p-5 text-sm shadow-sm">
                <h2 className="mb-3 inline-flex items-center gap-2 font-display text-base font-bold"><Lock className="h-4 w-4 text-[#003DA5]" /> Private</h2>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Only the RUNHTec purchasing team sees your prices.</li>
                  <li>• Other suppliers cannot see your list, and you cannot see theirs.</li>
                  <li>• Keep your link and password private. If you forget the password, ask RUNHTec for a new link.</li>
                  <li>• When a price changes, just type the new one. We are told about the change.</li>
                </ul>
              </div>
            </section>
          </>
        )}
      </main>

      <VendorItemDialog open={Boolean(editing)} onClose={() => setEditing(null)} item={editing?.id ? editing : null} currency={currency} onSave={saveOne} />
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
      <VendorBulkDialog open={bulk} onClose={() => setBulk(false)} currency={currency} onSave={saveMany} />
    </div>
  );
}

function ChangePassword({ open, onClose }) {
  const { toast } = useToast();
  const [f, setF] = useState({ current: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setF({ current: '', password: '', confirm: '' }); setErr(''); } }, [open]);
  const save = async () => {
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) { setErr('Use at least 8 characters, with letters and numbers.'); return; }
    if (f.password !== f.confirm) { setErr('The two new passwords are not the same.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await pb.post('/api/vendor/password', { current: f.current, password: f.password });
      pb.authStore.save(r.token, r.record);
      toast({ title: 'Password changed', description: 'Other phones or computers using your link are signed out.' });
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const box = (k, label, ac) => <Field label={label}><input type="password" autoComplete={ac} className={inputCls} value={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} aria-label={label} /></Field>;
  return (
    <Modal open={open} onClose={onClose} title="Change your password" description="You need this password with your link every time you open the supplier portal.">
      <div className="space-y-4">
        {box('current', 'Current password', 'current-password')}
        {box('password', 'New password', 'new-password')}
        {box('confirm', 'Type the new password again', 'new-password')}
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Change password</button>
        </div>
      </div>
    </Modal>
  );
}
