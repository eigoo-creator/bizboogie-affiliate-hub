# BizBoogie Affiliate Hub — PRD

## Original problem statement
"open repo" → user wanted the existing BizBoogie Affiliate Hub repo opened. After review, user asked for:
1. Fix the corrupted `api/go.js` (encoding + broken redirect line)
2. Visual refresh of `index.html` (full refresh, fix typos)
3. Add functionality: click tracking + admin dashboard + QR generator + 404 page
4. Deploy/test locally against Airtable (token + base id supplied)

## Architecture
- Static: `index.html`, `not-found.html`, `admin.html` served from repo root
- Serverless: `api/go.js`, `api/admin.js`, `api/qr.js` (Vercel functions; Node 20)
- Data: Airtable base `appcAUcJQ5lEBTv7D`, table `Affiliate Products`
- Local dev: `dev-server.js` simulates Vercel routing; supervisor runs two instances on ports 3000 (static) and 8001 (API) so the kubernetes ingress reaches both.

## User personas
- **Agent Z / Commander**: uses `/admin` to monitor clicks, copy links, generate QR.
- **Global Squad / Visitor**: hits `/go/<slug>` and gets redirected to the right partner link.
- **Landing visitor**: reads `/` to understand the hub.

## Core requirements (static)
- `/go/:slug` must never 500; falls back gracefully.
- Click tracking writes are fire-and-forget, never block the redirect.
- Admin endpoint requires `ADMIN_PASSWORD`.
- Everything configured via env vars; no secrets in source.

## Implemented (2026-04-24)
- [x] Clean `api/go.js`: case-insensitive slug lookup via Airtable formula, 302 redirect, `Click Count` + `Last Clicked` fire-and-forget increment (silently ignores `UNKNOWN_FIELD_NAME`), 302 to `/not-found.html` on miss or missing link.
- [x] `api/admin.js`: password-gated JSON of all records sorted by click count.
- [x] `api/qr.js`: PNG QR generator using `qrcode` package.
- [x] `index.html`: full visual refresh — Unbounded + JetBrains Mono, cyber/tactical EIGOO brand, grid bg, noise, scanlines, terminal card, stat cards, marquee, ecosystem grid. Fixed typos (`text-3 xl`, `bg-color-white`, `rounded-fell`).
- [x] `not-found.html`: glitch-404 page with EIGOO branding.
- [x] `admin.html`: password gate, KPIs (total slugs / clicks / approved / top), filterable table, copy-link, QR modal, logout, remember-me.
- [x] `vercel.json` rewrites for `/go/:slug` and `/admin`.
- [x] `dev-server.js` + dual-port supervisor config for local/preview end-to-end testing.
- [x] README + `.env.example` documenting all env vars and the two optional Airtable fields.
- [x] Verified via curl: `/`, `/go/:slug`, `/go/:slug` case-insensitive, `/go/unknown` → 404, `/not-found.html`, `/api/admin` (401 no pw / 200 with pw, 11 records), `/api/qr` (image/png 3.4KB).

## Prioritized backlog
- **P0** — done.
- **P1** — Show click-count coloring / sparkline once user adds `Click Count` + `Last Clicked` fields to Airtable (code already reads/writes them). Document: add those two fields to activate tracking.
- **P2** — CSV export from admin dashboard.
- **P2** — Bulk QR sheet (generate a PDF with every slug as a QR card).
- **P2** — UTM parameter injection on redirect (tag traffic per slug).
- **P2** — Optional per-slug password-gate (for limited-release missions).

## Next action items
1. In Airtable "Affiliate Products" table, add two fields to activate click tracking:
   - `Click Count` — Number (integer)
   - `Last Clicked` — Date with time
2. Deploy to Vercel: push to GitHub (via Save-to-Github), then in Vercel add env vars `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `ADMIN_PASSWORD`.
