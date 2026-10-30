import pb from '@/lib/pocketbaseClient';

// Escape a value for use inside a filter string.
const q = (v) => String(v).replace(/["\\]/g, '');

// Remove every record in `collection` whose `field` points at `id`.
// Silently skips if the user can't list that collection.
async function removeLinked(collection, field, id) {
  let list = [];
  try { list = await pb.collection(collection).getFullList({ filter: `${field}="${q(id)}"` }); } catch { return; }
  for (const r of list) {
    if (r[field] === id) await pb.collection(collection).delete(r.id);
  }
}

// Before deleting an invoice: remove the payments recorded against it.
export const deleteInvoicePayments = (invoiceId) => removeLinked('payments', 'invoice', invoiceId);

// Before deleting a project: remove its contractor engagements.
export const deleteProjectAssignments = (projectId) => removeLinked('project_assignments', 'project', projectId);
