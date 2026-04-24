# Test Credentials — BizBoogie Affiliate Hub

> **Do NOT commit real credentials here.** Real values live only in `/app/.env` (gitignored) and in the Vercel project's Environment Variables.

## Admin dashboard (/admin)
- Password: *(see `ADMIN_PASSWORD` in `/app/.env` or your Vercel project settings)*
- URL (preview): https://e7dacabf-5c22-406e-94ad-2555e7ec4650.preview.emergentagent.com/admin
- URL (prod): https://affiliate.bizboogie.com/admin
- API: `GET /api/admin?password=<ADMIN_PASSWORD>`

## Airtable
- Base: *(see `AIRTABLE_BASE_ID` in `/app/.env` — kept out of this file intentionally)*
- Table: `Affiliate Products`
- Token: `AIRTABLE_TOKEN` in `/app/.env` — has `data.records:read` + `data.records:write`, no schema write.

## Live slug for testing
- `/go/agent-z-rig` → Amazon affiliate URL (when env vars are set)
- `/go/bogus-slug` → 302 to `/not-found.html`

## Env var locations (source of truth)
- Local dev: `/app/.env`
- Production: Vercel → Project → Settings → Environment Variables
