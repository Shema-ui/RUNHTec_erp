import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  UserPlus,
  ShieldCheck,
  MoreHorizontal,
  KeyRound,
  Ban,
  CheckCircle2,
  Trash2,
  Lock,
  Loader2,
  Search,
} from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { ROLES, roleLabel } from '@/lib/permissions';
import { logActivity } from '@/lib/activity';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function StatusBadge({ status }) {
  return status === 'suspended' ? (
    <Badge className="border-transparent bg-rose-100 text-rose-700 hover:bg-rose-100">Suspended</Badge>
  ) : (
    <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
  );
}

function RoleBadge({ role }) {
  const isSuper = role === 'super_admin';
  return (
    <Badge
      variant="outline"
      className={isSuper ? 'border-primary/30 bg-accent text-primary' : 'text-muted-foreground'}
    >
      {isSuper && <ShieldCheck className="mr-1 h-3 w-3" />}
      {roleLabel(role)}
    </Badge>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await pb.collection('users').getFullList({ sort: 'name' });
      setUsers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleSuspend = async (u) => {
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    try {
      await pb.collection('users').update(u.id, { status: next });
      logActivity(next === 'suspended' ? 'Suspended user' : 'Reactivated user', u.email);
      toast({ title: next === 'suspended' ? 'User suspended' : 'User reactivated', description: u.email });
      load();
    } catch (err) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <PortalLayout title="User Management" subtitle="Provision and control portal accounts">
      <Helmet>
        <title>User Management | RUNHTec Business Portal</title>
        <meta name="description" content="Create, suspend, reset and manage RUNHTec portal user accounts and roles. Super Administrator only." />
      </Helmet>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add user
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Job title</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4" colSpan={5}>
                      <div className="h-5 w-full animate-pulse rounded bg-secondary" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                    No users match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isSuper = u.role === 'super_admin';
                  const isSelf = u.id === me?.id;
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-secondary/30">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                            {(u.name || u.email).slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {u.name || '—'} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                      <td className="px-5 py-3.5"><StatusBadge status={u.status} /></td>
                      <td className="px-5 py-3.5 text-muted-foreground">{u.job_title || '—'}</td>
                      <td className="px-5 py-3.5 text-right">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" /> Protected
                          </span>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-md p-1.5 hover:bg-secondary">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setResetTarget(u)}>
                                <KeyRound className="mr-2 h-4 w-4" /> Reset password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleSuspend(u)}>
                                {u.status === 'suspended' ? (
                                  <><CheckCircle2 className="mr-2 h-4 w-4" /> Reactivate</>
                                ) : (
                                  <><Ban className="mr-2 h-4 w-4" /> Suspend</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(u)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The Super Administrator account is protected and cannot be modified or deleted by any user.
      </p>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
      <DeleteUserDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} />
    </PortalLayout>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }) {
  const { toast } = useToast();
  const empty = { name: '', email: '', job_title: '', role: 'admin', password: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    setSaving(true);
    try {
      await pb.collection('users').create({
        name: form.name,
        email: form.email.trim(),
        job_title: form.job_title,
        role: form.role,
        status: 'active',
        verified: true,
        password: form.password,
        passwordConfirm: form.password,
      });
      logActivity('Created user', `${form.email} (${roleLabel(form.role)})`);
      toast({ title: 'User created', description: form.email });
      setForm(empty);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const data = err?.response?.data || {};
      if (data.email) setError('That email is already in use or invalid.');
      else setError(err.message || 'Could not create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) { onOpenChange(v); setError(''); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new user</DialogTitle>
          <DialogDescription>Provision an account. The user can sign in immediately.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="c-name">Full name</Label>
            <Input id="c-name" required value={form.name} onChange={set('name')} placeholder="e.g. Thabo Mokoena" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" required value={form.email} onChange={set('email')} placeholder="user@runhteccontractors.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-title">Job title</Label>
              <Input id="c-title" value={form.job_title} onChange={set('job_title')} placeholder="Operations Lead" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(ROLES).map((r) => (
                    <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-pw">Temporary password</Label>
            <Input id="c-pw" type="text" required value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ target, onClose }) {
  const { toast } = useToast();
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setPw(''); setError(''); }, [target]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    setSaving(true);
    try {
      await pb.collection('users').update(target.id, { password: pw, passwordConfirm: pw });
      logActivity('Reset password', target.email);
      toast({ title: 'Password reset', description: `New password set for ${target.email}` });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not reset password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {target?.email}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="r-pw">New password</Label>
            <Input id="r-pw" type="text" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ target, onClose, onDeleted }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      await pb.collection('users').delete(target.id);
      logActivity('Deleted user', target.email);
      toast({ title: 'User deleted', description: target.email });
      onDeleted();
      onClose();
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this user?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes <span className="font-medium text-foreground">{target?.email}</span> and
            revokes their access. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirm(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete user'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
