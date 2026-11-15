// A saved copy of the client's own portal data, kept on this phone so the app can
// still show quotes, invoices and projects without signal. It is removed on sign-out.
const KEY = 'runhtec-offline-portal';
const MAX_CHARS = 2_000_000;

// The parts worth keeping offline (photos and documents are too big and are left out).
const KEEP = ['client', 'settings', 'projects', 'quotes', 'invoices', 'payments', 'messages', 'requests', 'equipment', 'contracts', 'sites', 'news', 'toRate'];

export function saveSnapshot(clientId, data) {
  try {
    const picked = {};
    KEEP.forEach((k) => { picked[k] = data[k]; });
    const text = JSON.stringify({ clientId, savedAt: new Date().toISOString(), data: picked });
    if (text.length > MAX_CHARS) { localStorage.removeItem(KEY); return; }
    localStorage.setItem(KEY, text);
  } catch { /* storage full or blocked: the app simply works online */ }
}

export function loadSnapshot(clientId) {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s || s.clientId !== clientId) return null;
    return { savedAt: s.savedAt, data: { ...emptyPhotos(), ...s.data } };
  } catch { return null; }
}

export function clearSnapshot() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Pages that read photos or documents expect the keys to exist.
function emptyPhotos() { return { photos: [], docs: [] }; }
