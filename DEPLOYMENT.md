# Deployment Guide — Free Hosting

The RUNHTec ERP runs on three free services:

| Part | Service | Address |
|---|---|---|
| Frontend (`apps/web`, React) | GitHub Pages | https://erp.runhteccontractors.si |
| Backend (`apps/server`, Node/Express) | Render (free web service) | https://api.runhteccontractors.si |
| Database (MySQL-compatible) | TiDB Cloud Starter (free) | private — only the backend connects |

Domain DNS is managed in Hostinger (hPanel → Domains → runhteccontractors.si → DNS / Nameservers → DNS records).

> Free-plan behaviour: the Render backend sleeps after ~15 minutes without
> traffic. The first request after that takes about a minute while it wakes up.

## 1. Database — TiDB Cloud Starter

1. Sign up at https://tidbcloud.com and create a **Starter** cluster. Pick an AWS region in Europe (Frankfurt) to be close to the backend.
2. Open the cluster → **Connect**. Note the **Host**, **Port** (4000), **User** (looks like `xxxxxxxx.root`) and generate a **Password**.
3. Nothing else: the backend creates the `runhtec_erp` database and all tables on its first start.

## 2. Backend — Render

1. Sign up at https://render.com with GitHub.
2. **New → Blueprint** → select `Shema-ui/RUNHTec_erp`. Render reads `render.yaml`.
3. Fill in the values it asks for:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD` — from TiDB (step 1)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — the first Super Administrator login (password ≥ 8 characters)
4. **Apply**. When the deploy finishes, open `https://<service>.onrender.com/api/health` — it should return `{"message":"API is healthy.","code":200}`. The log shows `[migrate] applied 001_init.sql` and `[bootstrap] Created first super_admin account`.
5. Service → **Settings → Custom Domains → Add** `api.runhteccontractors.si`. In Hostinger DNS add a **CNAME**: Name `api`, Target = the `xxxx.onrender.com` address Render shows. Wait until Render shows the domain as verified (it issues HTTPS automatically).

The first admin account is only created when no super_admin exists, so the `ADMIN_*` variables can't be used to take over a running system. `ADMIN_PASSWORD` can be deleted after the first login.

## 3. Frontend — GitHub Pages

1. Repository **Settings → Pages → Source: GitHub Actions**.
2. **Actions** tab → **Deploy ERP frontend** → **Run workflow** (it also runs automatically on every change under `apps/web`).
3. **Settings → Pages → Custom domain**: `erp.runhteccontractors.si` → Save. In Hostinger DNS add a **CNAME**: Name `erp`, Target `shema-ui.github.io`. When the DNS check passes, tick **Enforce HTTPS**.

The build points the app at `https://api.runhteccontractors.si` (see `VITE_API_URL` in `.github/workflows/deploy-web.yml`).

## 4. Public website integration (optional)

The marketing site can send enquiries straight into the ERP:

```
POST https://api.runhteccontractors.si/api/website-intake
Content-Type: application/json

{ "type": "quote" | "service" | "contact", "name": "...", "email": "...", "phone": "...",
  "company": "...", "message": "...", "serviceType": "...", "urgency": "low" | "medium" | "high" }
```

`CORS_ORIGINS` in `render.yaml` already allows `runhteccontractors.si`.

## Environment variables (backend)

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Database connection |
| `DB_SSL=true` | Encrypted connection (required by cloud MySQL). Optional `DB_SSL_CA` for a provider-specific CA certificate |
| `JWT_SECRET` | Signs login tokens (Render generates it) |
| `CORS_ORIGINS` | Comma-separated sites allowed to call the API |
| `APP_URL` | Frontend address, used in links |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | First Super Administrator, created once |

## Known gaps before heavy production use

- **Password reset emails are not wired up** — `routes/auth.js` logs the reset link to the server log. Render's free plan also blocks outbound email ports, so this needs an HTTP email API (e.g. a transactional email service) when it's added.
- **Backups:** uploaded files are stored in the database. Export the database regularly from TiDB Cloud.
- **Do a full click-through** of every module after the first deploy.

## Verification checklist

- [ ] `https://api.runhteccontractors.si/api/health` returns `{"message":"API is healthy.","code":200}`
- [ ] `https://erp.runhteccontractors.si` loads and the Super Administrator can log in
- [ ] Refreshing a page like `/clients` still loads the app
- [ ] No CORS errors in the browser console
- [ ] Settings → Company Logo upload works
