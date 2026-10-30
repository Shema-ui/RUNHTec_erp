import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Delete button shown only to the Super Administrator.
 * Works inside clickable cards/links (it stops the click from opening the card).
 *
 * props:
 *  collection  – collection name, e.g. 'payments'
 *  id          – record id
 *  label       – what is being deleted, shown in the confirm box
 *  before(id)  – optional async cleanup run before the delete (e.g. remove child records)
 *  after(id)   – optional async step after the delete (refresh list, navigate away…)
 *  text        – optional button text (icon-only when omitted)
 */
export default function SuperDelete({ collection, id, label = 'this record', before, after, text, className = '' }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (user?.role !== 'super_admin' || !id) return null;

  const run = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete ${label}?\n\nThis is permanent and cannot be undone.`)) return;
    setBusy(true);
    try {
      if (before) await before(id);
      await pb.collection(collection).delete(id);
      toast({ title: 'Deleted', description: label.charAt(0).toUpperCase() + label.slice(1) });
      if (after) await after(id);
    } catch (err) {
      toast({ title: 'Could not delete', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title={`Delete (Super Admin only)`}
      aria-label={`Delete ${label}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-card px-2.5 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {text}
    </button>
  );
}
