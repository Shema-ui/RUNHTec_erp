import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Loader2, UserPlus, Link2, Unlink } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, Modal, Field, inputCls, btnPrimary, btnLine } from '@/components/erp/kit';
import { roleLabel } from '@/lib/permissions';

// One person, one record: links a contractor in the HR register to their ERP
// login, so engaging them on a project also puts them "on site" in the ERP.
export default function ContractorLoginCard({ contractor, onChanged }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === 'super_admin';
  const [account, setAccount] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [creating, setCreating] = useState(false);
  const [linkId, setLinkId] = useState('');

  useEffect(() => {
    if (contractor.user) pb.collection('users').getOne(contractor.user).then(setAccount).catch(() => setAccount(null));
    else setAccount(null);
    if (isOwner) pb.collection('users').getFullList({ sort: 'name' }).then((u) => setCandidates(u.filter((x) => ['technician', 'lead_technician'].includes(x.role)))).catch(() => {});
  }, [contractor.user]);

  const link = async (uid) => {
    try {
      await pb.collection('contractors').update(contractor.id, { user: uid || null });
      toast({ title: uid ? 'Login linked' : 'Login unlinked' });
      onChanged();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card title={<span className="inline-flex items-center gap-2"><KeyRound className="h-4 w-4" /> ERP login</span>}>
      {account ? (
        <div className="space-y-3 text-sm">
          <p><span className="font-medium">{account.name || account.email}</span> signs in as <strong>{roleLabel(account.role)}</strong> with <span className="text-muted-foreground">{account.email}</span>.</p>
          <p className="text-muted-foreground">When you engage this contractor on a project, they are added to that project’s “Technicians on site” automatically and get an alert.</p>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <Link className={btnLine} to={`/users/${account.id}/profile`}>View their profile</Link>
              <button className={btnLine} onClick={() => link(null)}><Unlink className="h-4 w-4" /> Unlink</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">This contractor can’t sign in to the ERP yet. Give them a login so they can see their projects, tick off tasks and add daily site photos.</p>
          {isOwner ? (
            <>
              <button className={btnPrimary} onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" /> Create ERP login</button>
              {candidates.length > 0 && (
                <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                  <Field label="…or link an existing technician login" className="min-w-[200px] flex-1">
                    <select className={inputCls} value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                      <option value="">Choose…</option>
                      {candidates.map((u) => <option key={u.id} value={u.id}>{u.name || u.email} — {roleLabel(u.role)}</option>)}
                    </select>
                  </Field>
                  <button className={btnLine} disabled={!linkId} onClick={() => link(linkId)}><Link2 className="h-4 w-4" /> Link</button>
                </div>
              )}
            </>
          ) : <p className="text-xs text-muted-foreground">Only the Super Administrator can create logins.</p>}
        </div>
      )}
      <CreateLoginDialog open={creating} contractor={contractor} onClose={() => setCreating(false)} onCreated={(uid) => link(uid)} />
    </Card>
  );
}

function CreateLoginDialog({ open, contractor, onClose, onCreated }) {
  const { toast } = useToast();
  const [f, setF] = useState({ email: '', role: 'technician', password: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF({ email: contractor.email || '', role: 'technician', password: '' }); }, [open]);
  const save = async () => {
    if (!f.email.trim() || f.password.length < 8) { toast({ title: 'Enter an email and a temporary password of at least 8 characters', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const u = await pb.collection('users').create({
        name: contractor.full_name, email: f.email.trim(), phone: contractor.phone || '', role: f.role,
        department: contractor.department || 'technical', job_title: '', status: 'active', verified: true,
        can_upload_documents: 0, profile_completed: 0, password: f.password, passwordConfirm: f.password,
      });
      toast({ title: 'Login created', description: `Give ${contractor.full_name} the email and temporary password. They will fill in their profile at first sign-in.` });
      onCreated(u.id); onClose();
    } catch (e) { toast({ title: 'Could not create the login', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`ERP login for ${contractor.full_name}`} description="They sign in with this email and the temporary password, then complete their profile.">
      <div className="space-y-4">
        <Field label="Email" required><input type="email" className={inputCls} value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></Field>
        <Field label="Role">
          <select className={inputCls} value={f.role} onChange={(e) => setF((p) => ({ ...p, role: e.target.value }))}>
            <option value="technician">Technician</option><option value="lead_technician">Lead Technician</option>
          </select>
        </Field>
        <Field label="Temporary password" required hint="At least 8 characters"><input className={inputCls} value={f.password} onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))} /></Field>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create login</button>
        </div>
      </div>
    </Modal>
  );
}
