# BizBoogie Affiliate Hub — EIGOO Inc. // Wayfinder's Hub

Serverless affiliate link router + ops dashboard, powered by Airtable, deployed on Vercel.

## Routes

| Path | What it does |
| --- | --- |
| `/` | Branded landing page (EIGOO / Wayfinder's Hub) |
| `/go/:slug` | Looks up `Slug` in Airtable, 302 to `Affiliate Link`, fire-and-forget click tracking |
| `/not-found.html` | 404 page shown for unknown / linkless slugs |
| `/admin` | Password-gated ops dashboard (click counts, QR, copy) |
| `/api/go?slug=…` | Raw redirect handler |
| `/api/admin?password=…` | JSON dump of all records + stats |
| `/api/qr?slug=…` | PNG QR code of the absolute `/go/:slug` URL |

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables:

| Key | Required | Example |
| --- | --- | --- |
| `AIRTABLE_TOKEN` | yes | `pat…` (Personal Access Token with `data.records:read` + `data.records:write` on this base) |
| `AIRTABLE_BASE_ID` | yes | `appcAUcJQ5lEBTv7D` |
| `AIRTABLE_TABLE` | no (defaults to `Affiliate Products`) | `Affiliate Products` |
| `ADMIN_PASSWORD` | yes (for `/admin`) | any strong string |
| `FALLBACK_URL` | no (defaults to `https://bizboogie.com`) | `https://bizboogie.com` |

See `.env.example`.

## Airtable schema

Table **Affiliate Products** must contain at minimum:
- `Slug` — *Single line text* — unique, lowercase recommended (e.g. `agent-z-rig`)
- `Affiliate Link` — *URL*

Optional (for click tracking — add these two fields to enable):
- `Click Count` — *Number (integer)*
- `Last Clicked` — *Date (with time, ISO)*

If these two fields are missing, redirects still work — the tracker just silently skips the write.

Other fields surfaced in the admin dashboard (all optional): `Product Name`, `Category`, `Mission`, `Platform`, `Commission Tier`, `Review/Pitch`, `Agent Z Approved`.

## Local dev

```bash
yarn install
cp .env.example .env   # fill in AIRTABLE_TOKEN etc.
yarn dev               # http://127.0.0.1:3000
```

`dev-server.js` is a small harness that mimics Vercel's routing (`/go/:slug` → `/api/go`, `/admin` → `admin.html`, `/api/*` → `api/*.js`). It's **not** used in production.

## Deployment

Vercel picks up `api/*.js` automatically and uses `vercel.json` rewrites for `/go/:slug` and `/admin`.

```bash
vercel --prod
```
