# BizBoogie Affiliate Hub — EIGOO Inc. // Wayfinder's Hub

Serverless affiliate link router + ops dashboard + channel attribution, powered by Airtable, deployed on Vercel.

## Routes

| Path | What it does |
| --- | --- |
| `/` | Branded landing page (EIGOO / Wayfinder's Hub) |
| `/go/:slug` | Looks up `Slug` in Airtable, 302 to `Affiliate Link`, fire-and-forget click tracking + attribution |
| `/go/:slug?src=ig&c=spring-drop` | Same, but tags the click with a source channel and optional campaign |
| `/not-found.html` | 404 page shown for unknown / linkless slugs |
| `/admin` | Password-gated ops dashboard: KPIs, channel attribution bars, filterable table, copy/QR with source picker |
| `/api/go?slug=…[&src=…&c=…]` | Raw redirect handler |
| `/api/admin?password=…` | JSON: records + stats + `attribution.bySource` + `attribution.bySlugSource` |
| `/api/qr?slug=…[&src=…&c=…]` | PNG QR encoding the attribution-tagged `/go/:slug` URL |

## Environment variables

| Key | Required | Example / default |
| --- | --- | --- |
| `AIRTABLE_TOKEN` | yes | `pat…` (PAT with `data.records:read` + `data.records:write` on this base) |
| `AIRTABLE_BASE_ID` | yes | `appXXXXXXXXXXXXXX` (starts with `app`) |
| `AIRTABLE_TABLE` | no — default `Affiliate Products` | `Affiliate Products` |
| `AIRTABLE_LOG_TABLE` | no — default `Click Log` | `Click Log` |
| `ADMIN_PASSWORD` | yes (for `/admin`) | any strong string |
| `FALLBACK_URL` | no — default `https://bizboogie.com` | `https://bizboogie.com` |

See `.env.example`.

## Airtable schema

### Required — table `Affiliate Products`
- `Slug` — *Single line text* (lowercase, e.g. `agent-z-rig`)
- `Affiliate Link` — *URL*

### Optional — fields on `Affiliate Products` (enable click tracking)
- `Click Count` — *Number (integer)*
- `Last Clicked` — *Date (with time)*
- `Last Source` — *Single line text*

### Optional — separate table `Click Log` (enable per-channel + per-domain attribution)
Create a table named exactly `Click Log` with columns:
- `Slug` — Single line text
- `Source` — Single line text (e.g. `ig`, `yt`, `tiktok`, `newsletter`, `discord`)
- `Campaign` — Single line text (optional secondary tag)
- `Clicked At` — Date (with time)
- `Referer` — Long text
- `User Agent` — Long text
- `Country` — Single line text (populated from Vercel/Cloudflare geo header)
- `Host` — Single line text (the domain that served the click, e.g. `play.bizboogie.com` — powers the Property Attribution panel)

If any of these optional fields/tables are missing, redirects still work — writes are silently skipped.

### Dashboard-surfaced (optional) fields
`Product Name`, `Category`, `Mission`, `Platform`, `Commission Tier`, `Review/Pitch`, `Agent Z Approved`.

## Attribution workflow

1. In the admin dashboard, choose a tag from the **"tag as"** dropdown (`ig`, `yt`, `tiktok`, …).
2. Click **Copy** on any slug — the URL copied to clipboard includes `?src=<tag>`.
3. Or click **QR** — the generated QR encodes the same tagged URL, so every scan is attributed.
4. Paste that tagged URL into your IG bio / YT card / newsletter / Discord / etc.
5. Every click increments both the aggregate `Click Count` AND writes a new row to `Click Log`.
6. Refresh the dashboard to see the **Channel Attribution** bars update.

## Local dev

```bash
yarn install
cp .env.example .env   # fill in AIRTABLE_TOKEN etc.
yarn dev               # http://127.0.0.1:3000
```

`dev-server.js` is a small harness that mimics Vercel's routing. Not used in production.

## Deployment

Vercel picks up `api/*.js` automatically and uses `vercel.json` rewrites for `/go/:slug` and `/admin`.

```bash
vercel --prod
```

Add `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `ADMIN_PASSWORD` to Vercel → Settings → Environment Variables before first deploy.
