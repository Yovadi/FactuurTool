# HAL5 Facturatie Manager (FactuurTool)

Desktop invoicing and booking app for HAL5 Overloon. The Windows app is already in production; tenants book rooms via the Netlify booking page. All business data lives in a **Supabase** project, not on Bolt.

## Independence from Bolt

This repository is the source of truth. Bolt.new was only the original builder.

The live database is already a normal Supabase project:

`https://qlvndvpxhqmjljjpehkn.supabase.co`

Current production data (verified read-only) includes tenants, leases, invoices, meeting-room bookings, and company settings. **Do not create a new empty database and “connect” it in Bolt** — that replaces the connection and can hide or lose the live data.

### Keep all data (required)

1. Create or log in to **your own** [Supabase](https://supabase.com) account. You must be an **organization owner**.
2. In Bolt, open this project → **Database** icon → **Advanced** → **Claim**.
3. Finish the claim steps in Supabase. The project appears in your Supabase dashboard. The URL and anon key stay the same, so the PC app and booking page keep working without a reinstall.
4. Disconnect Bolt from the database:
   - Bolt → gear → **All project settings** → **Applications** → Supabase → **Disconnect**
   - Supabase → **Organization settings** → **OAuth Apps** → delete **Bolt**
5. From now on, change schema with the SQL files in `supabase/migrations/` and deploy functions with the Supabase CLI. Do not use Bolt for database work.

Take a local backup first (does not change production):

```bash
cp .env.example .env   # fill VITE_SUPABASE_ANON_KEY from the booking page or Supabase dashboard
npm run db:backup -- --dry-run
npm run db:backup
```

Backups are written to `backups/` and are gitignored.

### Only if you later need a brand-new Supabase project

Claiming is enough for almost every case. A new project means a new URL, a rebuilt Electron installer, and an updated booking page. Use `npm run db:restore` against the **new** URL only, never against production.

## Local development

```bash
cp .env.example .env
npm install
npm run electron:dev
```

Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Database and edge functions

| Command | Purpose |
| --- | --- |
| `npm run db:backup -- --dry-run` | Count rows on the live project (read-only) |
| `npm run db:backup` | JSON dump to `backups/<timestamp>/` |
| `npm run db:restore -- --backup backups/<stamp> --target-url https://NEW.supabase.co` | Copy dump into a **new** project |
| `npx supabase link --project-ref qlvndvpxhqmjljjpehkn` | Link CLI after claiming |
| `npx supabase functions deploy` | Deploy `smtp-send`, `graph-send`, `resend-send`, `onedrive-upload`, `parse-invoice`, `eboekhouden-proxy` |

Edge functions read credentials from the request body (company settings), not from Bolt secrets.

## Booking page (Netlify)

`public/booking.html` is a static page. It still points at the same Supabase project. After a claim, leave those values as they are. Change them only if you migrate to a new project.
