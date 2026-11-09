// Installable app + phone notifications (see public/sw.js and server webpush.js).
import pb from '@/lib/pocketbaseClient';

let installEvent = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

// Call once at start-up (main.jsx).
export function setupPwa() {
  if (typeof window === 'undefined') return;
  // Chrome/Edge/Android offer installing through this event; keep it for our own "Install" button.
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; emit(); });
  window.addEventListener('appinstalled', () => { installEvent = null; emit(); });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
}

export const onPwaChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// Already running as the installed app?
export const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const canPromptInstall = () => Boolean(installEvent);

export async function promptInstall() {
  if (!installEvent) return false;
  installEvent.prompt();
  const { outcome } = await installEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
  installEvent = null; emit();
  return outcome === 'accepted';
}

// ── Notifications ────────────────────────────────────────────────────────────
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// iPhones only allow notifications for the installed app (Add to Home Screen).
export const pushNeedsInstall = () => isIOS() && !isInstalled();

const toKey = (b64) => {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg || navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready);
}

// 'on' | 'off' | 'blocked' | 'unsupported'
export async function pushStatus() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function turnOnPush() {
  if (!pushSupported()) throw new Error('This browser can’t show notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked. Allow them in your browser or phone settings, then try again.' : 'Notifications were not allowed.');
  const reg = await registration();
  const { publicKey } = await pb.get('/api/push/key');
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another server key can't be used: replace it.
  if (sub && sub.options?.applicationServerKey) {
    const old = new Uint8Array(sub.options.applicationServerKey);
    const want = toKey(publicKey);
    if (old.length !== want.length || old.some((v, i) => v !== want[i])) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
  await pb.post('/api/push/subscribe', { subscription: sub.toJSON() });
  return true;
}

export async function turnOffPush() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await pb.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// On sign-out: stop notifications on this device for the person leaving.
// Takes the token because the sign-in is cleared straight after.
export async function forgetDevice(token) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    if (token) {
      await fetch(`${pb.apiUrl}/api/push/unsubscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
    }
    await sub.unsubscribe().catch(() => {});
  } catch (_) { /* ignore */ }
}

// Opens the "App & notifications" window from anywhere (Dashboard banner, menus).
export const openAppDialog = () => window.dispatchEvent(new Event('runhtec:open-app'));

export const sendTestPush = () => pb.post('/api/push/test', {});
