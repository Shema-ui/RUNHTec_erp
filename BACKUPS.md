# Backups — RUNHTec ERP

There are two kinds of backup:

| | Weekly automatic backup | "Download full backup" button |
|---|---|---|
| Where | GitHub → Actions → **Database backup** | ERP → Settings (Super Admin) |
| What | The **whole** database: every record **and every uploaded file** (photos, IDs, PDFs, voice notes) | Records only, as a readable JSON file (no files, no passwords/PINs) |
| When | Every Sunday at 03:17 Kigali time, or any time you press **Run workflow** | When you click it |
| Kept | 90 days (about 13 weekly copies) | Wherever you save it |
| Safe? | Encrypted with **your** passphrase (AES-256) | Not encrypted: keep it private |

Use the weekly backup to recover from a disaster. Use the button for a quick copy you can read.

## One-time setup of the weekly backup (5 minutes)

1. Open https://github.com/Shema-ui/RUNHTec_erp → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** four times and add:

   | Name | Value |
   |---|---|
   | `DB_HOST` | same as `DB_HOST` on Render (Render → API service → Environment) |
   | `DB_USER` | same as `DB_USER` on Render |
   | `DB_PASSWORD` | same as `DB_PASSWORD` on Render |
   | `BACKUP_PASSPHRASE` | a long sentence only you know, e.g. *"Our first solar job was in Rubavu 2021!"* |

   **Write the passphrase down on paper and keep it safe.** Without it, nobody (not even you) can open the backups.
   Secrets are hidden. GitHub never shows them again, not even in a public repository.
3. Go to the **Actions** tab → **Database backup** → **Run workflow** → **Run workflow**.
4. After 1–3 minutes it shows a green tick. Open the run: under **Artifacts** you'll see `runhtec-erp-backup-YYYY-MM-DD`. That is your encrypted backup.

If a weekly run fails, GitHub emails you. The run's page says what is wrong (for example, a missing secret).

> Tip: once a month, download the newest artifact and keep it in your Google Drive too.

## Restoring (only after a disaster)

Ask a developer (or your AI assistant) to help. These are the steps:

1. Download the artifact (a `.zip`) and unzip it. You get `runhtec-erp-YYYY-MM-DD.sql.gz.enc`.
2. Decrypt it (Git Bash on Windows, or Terminal on Mac/Linux):
   ```
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in runhtec-erp-YYYY-MM-DD.sql.gz.enc -out backup.sql.gz
   gunzip backup.sql.gz
   ```
   It asks for the passphrase. "bad decrypt" means the passphrase is wrong.
3. Create a new empty cluster in TiDB Cloud (or use the existing one), then load the file:
   ```
   mysql --host=<DB_HOST> --port=4000 --user=<DB_USER> -p --ssl-mode=VERIFY_IDENTITY < backup.sql
   ```
   The file recreates the `runhtec_erp` database with all tables and files.
4. If you used a new cluster, update `DB_HOST`, `DB_USER` and `DB_PASSWORD` on Render (and in the GitHub secrets). Render restarts the API by itself.
