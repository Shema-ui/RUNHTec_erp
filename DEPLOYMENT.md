# Deployment Guide

Target topology:

- `app.runhteccontractors.com` — static build of `apps/web` (Vite/React)
- `api.runhteccontractors.com` — `apps/pocketbase` (PocketBase server)
- Public marketing site (`runhteccontractors.com`, separate project) submits
  form data to `https://api.runhteccontractors.com/api/website-intake`

## 1. Backend (PocketBase) — api.runhteccontractors.com

1. Download the official PocketBase binary matching your server OS from
   https://pocketbase.io/docs/ and place it at `apps/pocketbase/pocketbase`
   (or point `--dir`/binary path at wherever you install it). The custom
   `horizons migrations:up` / `migrations:revert` commands are implemented in
   `pb_hooks/custom-migrations-cmd.pb.js`, so any standard PocketBase build
   works — no Hostinger-specific binary is required.
2. Set the encryption key as an environment variable before starting:
   ```
   export PB_ENCRYPTION_KEY="<32+ char random secret, generate once and keep it>"
   ```
   Losing this key after storing encrypted settings makes them unrecoverable — store it in a secrets manager.
3. Create the superuser account. Two of the original migration files that did
   this (`1785371029_seed_shema_nicholas.js`, `1764579159_create_superuser.js`)
   are intentionally gitignored (they'd otherwise ship a hardcoded account).
   On a fresh server, run:
   ```
   ./pocketbase superuser create you@runhteccontractors.com "<strong-password>"
   ```
4. Start the server (this also applies all `pb_migrations/*.js` automatically):
   ```
   ./pocketbase serve --http=0.0.0.0:8090 \
     --encryptionEnv=PB_ENCRYPTION_KEY \
     --dir=/data \
     --migrationsDir=./pb_migrations \
     --hooksDir=./pb_hooks \
     --hooksWatch=false
   ```
5. Put this behind a reverse proxy (nginx/Caddy) terminating TLS at
   `api.runhteccontractors.com`, proxying to `127.0.0.1:8090`.
6. **Note on `/`:** `pb_hooks/external-dashboard.pb.js` proxies the PocketBase
   admin UI HTML from a Hostinger-hosted CDN URL instead of using the
   built-in embedded admin UI. This is an external dependency outside your
   infrastructure — if it goes down or the URL changes, `/` (and only `/`)
   on the API domain will fail to load the admin dashboard, though the API
   itself keeps working. If you'd rather not depend on it, delete this hook
   file and PocketBase will serve its own bundled admin UI at `/_/` instead.
7. Confirm collections applied correctly:
   ```
   curl https://api.runhteccontractors.com/api/health
   ```

## 2. Frontend (Vite/React) — app.runhteccontractors.com

1. Copy `apps/web/.env.example` to `apps/web/.env.production` and set:
   ```
   VITE_POCKETBASE_URL=https://api.runhteccontractors.com
   ```
2. Build:
   ```
   npm install
   npm run build   # outputs to dist/apps/web
   ```
3. Deploy the contents of `dist/apps/web` as a static site (Nginx, Cloudflare
   Pages, Vercel static, etc.) at `app.runhteccontractors.com`.
4. Because this is a client-side router (React Router), configure your host
   to rewrite all unmatched paths to `index.html` (SPA fallback), or deep
   links like `/crm/clients/abc123` will 404 on refresh.
5. Set CORS on the PocketBase server to allow `https://app.runhteccontractors.com`
   as an origin (PocketBase Admin UI → Settings → or via API rules if you
   lock this down further).

## 3. Public website integration

The public site only needs to `POST` JSON to one endpoint — it never talks
to PocketBase collections directly:

```
POST https://api.runhteccontractors.com/api/website-intake
Content-Type: application/json

{
  "type": "quote" | "service" | "contact",
  "name": "...",
  "email": "...",
  "phone": "...",
  "company": "...",
  "message": "...",
  "serviceType": "...",
  "urgency": "low" | "medium" | "high"
}
```

This creates/reuses a client record, links a contact, and creates the
appropriate `rfqs` record (`quote_request` / `service_request` /
`contact_enquiry`), all visible immediately in the internal app's RFQs page.

## 4. Verification checklist before going live

- [ ] `npm run build` completes with no errors (fixed — see summary)
- [ ] Login works against the production PocketBase URL
- [ ] Submitting the public site's contact/quote/service forms creates
      records visible in `/crm/clients` and `/rfqs`
- [ ] Dashboard stat cards show non-zero, correct-looking counts
- [ ] Browser console shows no failed requests to `/hcgi/platform` (that
      path only resolves inside Hostinger Horizons hosting)
