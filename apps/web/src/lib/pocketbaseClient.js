// Drop-in replacement for the PocketBase JS SDK client. This project's
// backend moved from PocketBase to a custom Node/Express/MySQL API (see
// apps/server) because PocketBase — a persistent Go binary — cannot run on
// Hostinger shared hosting, which only supports Node.js apps and static
// sites. Every page component still calls `pb.collection(x).getList(...)`,
// `pb.authStore.record`, `pb.files.getURL(...)` etc. exactly as before —
// this file implements that same surface against the new REST API so none
// of those ~25 call sites needed to change.
//
// Deliberately NOT implemented (unused elsewhere in this codebase, per a
// full grep of the SDK surface actually called): realtime subscriptions,
// batch requests, OAuth2, admin/superuser auth.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8090';
const STORAGE_KEY = 'runhtec_auth';

class AuthStore {
  constructor() {
    this.listeners = [];
    this.token = null;
    this.record = null;
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.token = parsed.token || null;
        this.record = parsed.record || null;
      }
    } catch (_) {
      this.token = null;
      this.record = null;
    }
  }

  get isValid() {
    return Boolean(this.token);
  }

  save(token, record) {
    this.token = token;
    this.record = record;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, record }));
    this._notify();
  }

  clear() {
    this.token = null;
    this.record = null;
    localStorage.removeItem(STORAGE_KEY);
    this._notify();
  }

  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  _notify() {
    this.listeners.forEach((cb) => cb(this.token, this.record));
  }
}

const authStore = new AuthStore();

function buildQuery(params) {
  const parts = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;

  let body = options.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, body });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // no JSON body (e.g. some error responses) — leave data null
  }

  if (!res.ok) {
    const message = data?.message || `Request failed with status ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function collection(name) {
  return {
    async getList(page = 1, perPage = 30, opts = {}) {
      const qs = buildQuery({ page, perPage, filter: opts.filter, sort: opts.sort, expand: opts.expand });
      return request(`/api/collections/${name}/records${qs}`);
    },

    async getFullList(opts = {}) {
      const qs = buildQuery({ filter: opts.filter, sort: opts.sort, expand: opts.expand, __fullList: '1' });
      const res = await request(`/api/collections/${name}/records${qs}`);
      return res.items;
    },

    async getOne(id, opts = {}) {
      const qs = buildQuery({ expand: opts.expand });
      return request(`/api/collections/${name}/records/${id}${qs}`);
    },

    async create(data) {
      return request(`/api/collections/${name}/records`, { method: 'POST', body: data });
    },

    async update(id, data) {
      return request(`/api/collections/${name}/records/${id}`, { method: 'PATCH', body: data });
    },

    async delete(id) {
      return request(`/api/collections/${name}/records/${id}`, { method: 'DELETE' });
    },

    // Auth methods — only meaningful for the `users` collection, matching
    // how the PocketBase SDK scopes them, but defined generically since
    // that's how the existing pages call them (`pb.collection('users').authWithPassword(...)`).
    async authWithPassword(identity, password) {
      const res = await request('/api/collections/users/auth-with-password', { method: 'POST', body: { identity, password } });
      authStore.save(res.token, res.record);
      return res;
    },

    async authRefresh() {
      const res = await request('/api/collections/users/auth-refresh', { method: 'GET' });
      authStore.save(res.token, res.record);
      return res;
    },

    async requestPasswordReset(email) {
      return request('/api/collections/users/request-password-reset', { method: 'POST', body: { email } });
    },

    async confirmPasswordReset(token, password, passwordConfirm) {
      return request('/api/collections/users/confirm-password-reset', { method: 'POST', body: { token, password, passwordConfirm } });
    },
  };
}

const pb = {
  authStore,
  collection,
  files: {
    // Matches the PocketBase SDK's pb.files.getURL(record, filename) shape.
    // `filename` here is actually a files.id from the new backend — the
    // record argument is accepted for interface compatibility but unused.
    getURL(_record, filenameOrId) {
      if (!filenameOrId) return '';
      return `${API_URL}/api/files/${filenameOrId}`;
    },
  },
};

export default pb;
export { pb };
