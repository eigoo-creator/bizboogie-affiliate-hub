# Drop-in Affiliate Router for Emergent (React + FastAPI) apps

Add `/go/:slug` affiliate redirects + shared click tracking to **techops-hub-4**, **stream-admin-test**, or any other Emergent full-stack project — without rebuilding any of the UI you already have.

All three domains (`bizboogie.com`, `play.bizboogie.com`, `cyberops.bizboogie.com`) will feed the **same** Airtable base, so the single admin dashboard at `affiliate.bizboogie.com/admin` shows unified per-domain + per-source stats.

---

## What you're installing (2 files per project)

| File | Where it goes | Why |
| --- | --- | --- |
| `affiliate_router.py` | your FastAPI backend folder (next to `server.py`) | Adds `GET /api/go/{slug}`, `GET /api/admin`, `GET /api/qr` |
| `GoRedirect.jsx` | your React `src/` folder | Lets the memorable `/go/:slug` URL work on Emergent's ingress (which only routes `/api/*` to the backend) |

## 5-step install (do this inside each Emergent brand session)

Paste this prompt into the chat of `techops-hub-4` and then `stream-admin-test`:

> I want to add affiliate link redirection to this app. I have two files I'll paste below:
>
> 1. A FastAPI router `affiliate_router.py` — add it next to `server.py`.
> 2. A React component `GoRedirect.jsx` — add it under `frontend/src/components/`.
>
> Steps:
>
> **a.** Place both files as described.
>
> **b.** In `server.py`, add these two lines near the top imports and router registration:
> ```python
> from affiliate_router import router as affiliate_router
> app.include_router(affiliate_router)
> ```
>
> **c.** In `frontend/src/App.js` (or wherever the React Router `<Routes>` live), add:
> ```jsx
> import GoRedirect from "./components/GoRedirect";
> // inside <Routes>:
> <Route path="/go/:slug" element={<GoRedirect />} />
> ```
>
> **d.** Add to `backend/requirements.txt`:
> ```
> httpx>=0.27
> qrcode[pil]>=7.4
> ```
> Install with `pip install -r requirements.txt` and restart the backend.
>
> **e.** Add these env vars to `backend/.env`:
> ```
> AIRTABLE_TOKEN=REDACTED_TOKEN
> AIRTABLE_BASE_ID=appcAUcJQ5lEBTv7D
> AIRTABLE_TABLE=Affiliate Products
> AIRTABLE_LOG_TABLE=Click Log
> ADMIN_PASSWORD=REDACTED_ADMIN_PW
> FALLBACK_URL=https://bizboogie.com
> ```
> Restart the backend with `sudo supervisorctl restart backend`.
>
> Test with: `curl -I {REACT_APP_BACKEND_URL}/api/go/agent-z-rig` — should return 302 to the Airtable "Affiliate Link".
>
> Don't touch any of the existing brand UI — this is purely additive.

Then paste the contents of `affiliate_router.py` and `GoRedirect.jsx`.

## Verifying everything wired up

After both brand sessions finish:

1. In this (`open-repo-7`) session, hit these endpoints and confirm 302s:
   ```
   curl -I https://techops-hub-4.preview.emergentagent.com/go/agent-z-rig?src=cyberops
   curl -I https://stream-admin-test.preview.emergentagent.com/go/agent-z-rig?src=play
   curl -I https://affiliate.bizboogie.com/go/agent-z-rig
   ```
   All three should 302 to the same Amazon URL.

2. Open `https://affiliate.bizboogie.com/admin` → enter `REDACTED_ADMIN_PW`.
3. The **Property Attribution** panel should now show:
   - `techops-hub-4.preview.emergentagent.com` — 1 click
   - `stream-admin-test.preview.emergentagent.com` — 1 click
   - `affiliate.bizboogie.com` — 1 click
4. Hook up the real custom domains (see below) and the hostnames in that panel will flip to `cyberops.bizboogie.com` / `play.bizboogie.com` / `bizboogie.com`.

## Custom domain hookup

Each Emergent project has its own preview URL. To get `play.bizboogie.com` and `cyberops.bizboogie.com` pointing at them, two paths:

**A. Emergent-native deployment + custom domain**
Ask Emergent support (or the deploy UI) for custom-domain instructions on each of those two projects. Add the CNAME records they provide to your DNS.

**B. Port to Vercel**
If/when you GitHub-export those Emergent projects, you can attach the domains in Vercel the same way `affiliate.bizboogie.com` is wired. In that case **you don't need `GoRedirect.jsx`** — just convert `affiliate_router.py` routes to Vercel serverless Python functions, OR replace FastAPI handling by copying the Node `api/*.js` files from this repo.

## Env-var strategy (important)

All three brand apps **share** `AIRTABLE_TOKEN` + `AIRTABLE_BASE_ID` so clicks land in one place. If a brand wants its own isolated pool later, give it a different `AIRTABLE_BASE_ID` / `AIRTABLE_TABLE` — the router respects those envs automatically.

`ADMIN_PASSWORD` is *only* needed in whichever app serves `/api/admin`. Since the main `affiliate.bizboogie.com` already serves the admin dashboard, you can leave `ADMIN_PASSWORD` unset on the other two — their `/api/admin` endpoint simply returns 500, which is fine.

## Troubleshooting

- **`/go/:slug` returns the React 404 page** → `GoRedirect.jsx` isn't wired into your React router. Check the `<Route>` is inside `<Routes>` and the import path is correct.
- **`/api/go/:slug` returns 500** → missing `AIRTABLE_TOKEN` or `AIRTABLE_BASE_ID` in `backend/.env`. Restart backend after editing `.env`.
- **302 works but Airtable click count doesn't move** → you haven't added `Click Count` / `Last Clicked` / `Last Source` fields to the `Affiliate Products` table. Add them in Airtable — code will start writing on the next click, no redeploy.
- **Admin dashboard shows `attribution.available: false`** → `Click Log` table doesn't exist in the shared Airtable base. Create it per the schema in `/app/README.md`.
