import Pocketbase from 'pocketbase';

// In Hostinger Horizons hosting, '/hcgi/platform' is rewritten to the bundled
// PocketBase instance automatically (see vite.config.js dev proxy for the
// local equivalent). For a standalone deployment — e.g. this app served from
// app.runhteccontractors.com talking to a separate api.runhteccontractors.com —
// set VITE_POCKETBASE_URL at build time to the full backend URL.
const POCKETBASE_API_URL = import.meta.env.VITE_POCKETBASE_URL || '/hcgi/platform';

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
