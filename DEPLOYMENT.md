# Deployment Guide — Hostinger Shared/Business Hosting

This supersedes an earlier version of this file that described a
PocketBase + VPS topology. The backend was rebuilt as Node/Express/MySQL
specifically so the **entire system** — frontend and backend — can run on
a single Hostinger shared/Business plan, no VPS required.

Target topology:

- `app.runhteccontractors.com` — static build of `apps/web` (Vite/React)
- `api.runhteccontractors.com` — `apps/server` (Node/Express), deployed via
  Hostinger's Node.js Web App hosting
- MySQL database — a standard Hostinger-provisioned MySQL database
- Public marketing site (`runhteccontractors.com`, separate project) posts
  to `https://api.runhteccontractors.com/api/website-intake`

## 1. Create the MySQL database

hPanel → Databases → MySQL Databases → create a new database and a new
database user with full privileges on it. Note down:

- Database name
- Database username
- Database password
- Database host (Hostinger shared hosting almost always uses `localhost`
  when the Node app and MySQL are on the same account — confirm in hPanel)

## 2. Deploy the backend (`apps/server`) as a Node.js Web App

1. hPanel → Websites → your domain → **Node.js** (or **Deploy Web App** →
   Node.js, wording varies by Hostinger's current UI).
2. Connect your GitHub account, select `Shema-ui/RUNHTec_erp`, branch
   `main`.
3. **Application root**: `apps/server`
4. **Startup file**: `src/index.js`
5. **Node version**: 18 or later
6. Hostinger installs dependencies (`npm install`) and starts the app
   automatically on deploy; redeploys happen automatically on new commits
   to `main` (confirm auto-redeploy is enabled in the Git settings).
7. **Environment variables** — set these in the Node.js app's environment
   variable panel (do not commit a real `.env` file):
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=<your MySQL username>
   DB_PASSWORD=<your MySQL password>
   DB_NAME=<your MySQL database name>
   JWT_SECRET=<generate with: openssl rand -hex 32>
   CORS_ORIGINS=https://app.runhteccontractors.com
   APP_URL=https://app.runhteccontractors.com
   PORT=8090
   ```
   `PORT` may be overridden by Hostinger's platform — check their Node.js
   hosting docs for whether they inject their own `PORT` value; the app
   reads `process.env.PORT` either way.
8. On first successful boot, the app runs the SQL migration automatically
   and creates all 21 tables. Check the deploy log for
   `[migrate] applied 001_init.sql`.
9. Point `api.runhteccontractors.com` at this Node.js app (Hostinger's
   Node.js hosting panel provides the subdomain/domain binding step; SSL
   is typically automatic via their shared hosting TLS).

### Create the first Super Administrator account

There is no seeded account in this backend (unlike the earlier PocketBase
version, which shipped one in a migration file — deliberately not repeated
here). The simplest way to create the first account is the included
script — if your Hostinger plan includes SSH/terminal access to the Node
app, run this once from inside `apps/server` (it reads the same database
environment variables the app itself uses):

```bash
node scripts/create-superuser.js you@runhteccontractors.com "a-strong-password" "Your Name"
```

Safe to re-run — if the email already exists it just resets the password
instead of failing.

If your plan doesn't offer SSH access, do it directly through hPanel's
phpMyAdmin (Databases → phpMyAdmin) instead:
```sql
INSERT INTO users (id, email, password_hash, name, role, status)
VALUES ('changeme01', 'you@runhteccontractors.com', '<bcrypt hash>', 'Your Name', 'super_admin', 'active');
```
Generate the bcrypt hash on any machine with Node installed:
```
node -e "require('bcryptjs').hash('your-password', 10).then(console.log)"
```

## 3. Deploy the frontend (`apps/web`) to shared hosting

1. hPanel → Websites → your domain → **Add subdomain**: `app.runhteccontractors.com`.
2. hPanel → that subdomain → **Advanced → Git**. Connect the same repo,
   branch `main`.
3. Settings:
   - **Root/subdirectory**: `apps/web`
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
4. **Environment variable**:
   ```
   VITE_API_URL=https://api.runhteccontractors.com
   ```
5. Deploy. Add this `.htaccess` in the deployed folder (via File Manager)
   so React Router doesn't 404 on refresh:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

## 4. Public website integration

Unchanged in shape from before — the public site only needs to `POST` JSON
to one endpoint:

```
POST https://api.runhteccontractors.com/api/website-intake
Content-Type: application/json

{
  "type": "quote" | "service" | "contact",
  "name": "...", "email": "...", "phone": "...", "company": "...",
  "message": "...", "serviceType": "...", "urgency": "low" | "medium" | "high"
}
```

## 5. Known gaps to close before real production use

- **Password reset emails are not wired up.** `apps/server/src/routes/auth.js`
  currently logs the reset link to the server console instead of emailing
  it. Needs an SMTP integration (nodemailer + Hostinger's own email
  hosting SMTP credentials, or a transactional email provider) before
  "Forgot password" works for real users.
- **No first-run browser QA.** Everything so far was verified via direct
  API calls against a real MySQL instance, and the frontend build/lint
  passed clean — but no one has clicked through the actual running app in
  a browser yet. Do a full pass through each module after deploying.
- **Backup strategy for MySQL.** Uploaded files (logos, signatures, client
  documents) live inside the database now (as BLOBs), not just structured
  data — make sure whatever MySQL backup schedule you set up in hPanel
  covers this database, since it's now the single source of truth for
  everything, including files.

## Verification checklist

- [ ] `https://api.runhteccontractors.com/api/health` returns
      `{"message":"API is healthy.","code":200}`
- [ ] `https://app.runhteccontractors.com` loads and login works with the
      Super Administrator account created in step 2
- [ ] Browser console shows no CORS errors
- [ ] A test submission through the public website's contact/quote form
      creates a client + RFQ visible in the internal app
- [ ] File upload (Settings → Company Logo) round-trips correctly
