import pb from '@/lib/pocketbaseClient';

// Next document number, e.g. Q-2026-0008: highest number this year + 1, so a
// deleted document never frees its number for reuse. (The server also refuses
// duplicates and picks the next free number itself.)
export async function nextDocNumber(collection, field, prefix) {
  const year = new Date().getFullYear();
  try {
    const list = await pb.collection(collection).getFullList({ sort: '-created' });
    const max = list.reduce((m, r) => {
      const v = String(r[field] || '');
      return v.startsWith(`${prefix}-${year}-`) ? Math.max(m, parseInt(v.split('-').pop(), 10) || 0) : m;
    }, 0);
    return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
  } catch {
    return `${prefix}-${year}-0001`;
  }
}
