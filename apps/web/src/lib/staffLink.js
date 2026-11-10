// The private staff sign-in link is remembered on a staff member's own device
// after they sign in with it, so a signed-out staff member is sent back to it
// (everyone else lands on the client sign-in page).
const KEY = 'runhtec-staff-link';
export function rememberStaffLink(key) { try { localStorage.setItem(KEY, key); } catch { /* ignore */ } }
export function staffSignInPath() {
  try { const k = localStorage.getItem(KEY); return k ? `/staff/${k}` : '/login'; } catch { return '/login'; }
}
export function forgetStaffLink() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
