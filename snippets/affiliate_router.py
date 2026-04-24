"""
affiliate_router.py — drop-in affiliate-link router for FastAPI apps.

What it adds
------------
- GET  /api/go/{slug}[?src=ig&c=spring-drop]  -> 302 to the Airtable "Affiliate Link"
                                                  Fire-and-forget click tracking + attribution.
- GET  /api/admin?password=...                -> JSON: products + per-source + per-host stats.
- GET  /api/qr?slug=...&src=...&c=...         -> PNG QR of /go/{slug}?src=...

It targets the SAME Airtable base as the main BizBoogie Affiliate Hub, so every
brand (play.bizboogie.com, cyberops.bizboogie.com, bizboogie.com) feeds a single
source of truth. The Host header is captured so the central dashboard shows
per-domain attribution.

Env vars (set in the host app's .env)
-------------------------------------
  AIRTABLE_TOKEN        required
  AIRTABLE_BASE_ID      required
  AIRTABLE_TABLE        default "Affiliate Products"
  AIRTABLE_LOG_TABLE    default "Click Log"
  ADMIN_PASSWORD        required for /api/admin
  FALLBACK_URL          default "https://bizboogie.com"

Install
-------
  1. Drop this file into your backend folder (next to server.py).
  2. In server.py:
         from affiliate_router import router as affiliate_router
         app.include_router(affiliate_router)
  3. Add to requirements.txt:
         httpx>=0.27
         qrcode[pil]>=7.4
"""

from __future__ import annotations

import asyncio
import io
import os
import re
import urllib.parse
from datetime import datetime, timezone
from typing import Any

import httpx
import qrcode
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse, Response

router = APIRouter()

AIRTABLE_API = "https://api.airtable.com/v0"
TOKEN = os.environ.get("AIRTABLE_TOKEN")
BASE_ID = os.environ.get("AIRTABLE_BASE_ID")
TABLE = os.environ.get("AIRTABLE_TABLE", "Affiliate Products")
LOG_TABLE = os.environ.get("AIRTABLE_LOG_TABLE", "Click Log")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD")
FALLBACK_URL = os.environ.get("FALLBACK_URL", "https://bizboogie.com")

_SRC_RE = re.compile(r"[^a-z0-9_\-]")


def _clip(v: Any, n: int = 500) -> str:
    return ("" if v is None else str(v))[:n]


def _headers() -> dict:
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def _table_url(table: str) -> str:
    return f"{AIRTABLE_API}/{BASE_ID}/{urllib.parse.quote(table)}"


async def _lookup_slug(slug: str) -> dict | None:
    formula = f'LOWER({{Slug}})="{slug.replace(chr(34), chr(92) + chr(34))}"'
    params = {"maxRecords": 1, "filterByFormula": formula}
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(_table_url(TABLE), headers=_headers(), params=params)
    if r.status_code != 200:
        return None
    records = r.json().get("records", [])
    return records[0] if records else None


async def _increment_click(record: dict, src: str) -> None:
    """Fire-and-forget: bump Click Count + Last Clicked (+ Last Source if field exists)."""
    rid = record["id"]
    current = int((record.get("fields") or {}).get("Click Count") or 0)
    now = datetime.now(timezone.utc).isoformat()
    patch = {"Click Count": current + 1, "Last Clicked": now, "Last Source": src}
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.patch(
                f"{_table_url(TABLE)}/{rid}",
                headers=_headers(),
                json={"fields": patch},
            )
            if r.status_code == 422 and "UNKNOWN_FIELD_NAME" in r.text:
                patch.pop("Last Source", None)
                await client.patch(
                    f"{_table_url(TABLE)}/{rid}",
                    headers=_headers(),
                    json={"fields": patch},
                )
    except Exception:
        pass  # never block redirect on tracking


async def _log_click(fields: dict) -> None:
    """Fire-and-forget: write a row to the Click Log table if it exists."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.post(
                _table_url(LOG_TABLE),
                headers=_headers(),
                json={"records": [{"fields": fields}]},
            )
            if r.status_code == 422 and "UNKNOWN_FIELD_NAME" in r.text:
                # Retry without Host (most likely missing column)
                fields.pop("Host", None)
                await client.post(
                    _table_url(LOG_TABLE),
                    headers=_headers(),
                    json={"records": [{"fields": fields}]},
                )
    except Exception:
        pass


@router.get("/api/go/{slug}")
@router.get("/go/{slug}")  # works too if the host reverse-proxies /go/* to the backend
async def go(slug: str, request: Request,
             src: str = Query("direct"), c: str = Query("")):
    slug = (slug or "").strip().lower()
    if not slug:
        return RedirectResponse(FALLBACK_URL, status_code=302)
    if not TOKEN or not BASE_ID:
        return RedirectResponse(f"{FALLBACK_URL}?error=missing_env", status_code=302)

    src_norm = _SRC_RE.sub("", (src or "direct").lower())[:64] or "direct"
    campaign = _clip(c, 120)

    try:
        rec = await _lookup_slug(slug)
    except Exception:
        return RedirectResponse(f"{FALLBACK_URL}?error=lookup_failed", status_code=302)

    if not rec:
        return RedirectResponse(f"/not-found.html?slug={urllib.parse.quote(slug)}", status_code=302)

    link = (rec.get("fields") or {}).get("Affiliate Link")
    now_iso = datetime.now(timezone.utc).isoformat()
    host = _clip(request.headers.get("x-forwarded-host") or request.headers.get("host"), 120)
    referer = _clip(request.headers.get("referer") or request.headers.get("referrer"))
    ua = _clip(request.headers.get("user-agent"))
    country = _clip(
        request.headers.get("x-vercel-ip-country")
        or request.headers.get("cf-ipcountry")
        or "",
        8,
    )

    asyncio.create_task(_increment_click(rec, src_norm))
    asyncio.create_task(_log_click({
        "Slug": slug, "Source": src_norm, "Campaign": campaign,
        "Clicked At": now_iso, "Referer": referer, "User Agent": ua,
        "Country": country, "Host": host,
    }))

    if not link:
        return RedirectResponse(
            f"/not-found.html?slug={urllib.parse.quote(slug)}&reason=no_link",
            status_code=302,
        )
    return RedirectResponse(str(link), status_code=302)


@router.get("/api/admin")
async def admin(password: str = Query(""), request: Request = None):
    if not ADMIN_PW:
        return JSONResponse({"error": "ADMIN_PASSWORD not configured"}, status_code=500)
    pw = password or (request.headers.get("x-admin-password") if request else "")
    if pw != ADMIN_PW:
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    if not TOKEN or not BASE_ID:
        return JSONResponse({"error": "missing airtable env"}, status_code=500)

    products: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            offset = None
            while True:
                params = {"pageSize": 100}
                if offset:
                    params["offset"] = offset
                r = await client.get(_table_url(TABLE), headers=_headers(), params=params)
                r.raise_for_status()
                data = r.json()
                for rec in data.get("records", []):
                    f = rec.get("fields") or {}
                    products.append({
                        "id": rec["id"],
                        "slug": f.get("Slug"),
                        "productName": f.get("Product Name"),
                        "affiliateLink": f.get("Affiliate Link"),
                        "category": f.get("Category"),
                        "mission": f.get("Mission"),
                        "platform": f.get("Platform"),
                        "commissionTier": f.get("Commission Tier"),
                        "approved": f.get("Agent Z Approved") is True,
                        "clickCount": int(f.get("Click Count") or 0),
                        "lastClicked": f.get("Last Clicked"),
                        "lastSource": f.get("Last Source"),
                    })
                offset = data.get("offset")
                if not offset:
                    break
    except Exception as e:
        return JSONResponse({"error": "lookup_failed", "detail": str(e)}, status_code=500)

    # Logs (optional table)
    logs: list[dict] = []
    log_available = True
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            offset, fetched = None, 0
            while fetched < 2000:
                params = {"pageSize": 100}
                if offset:
                    params["offset"] = offset
                r = await client.get(_table_url(LOG_TABLE), headers=_headers(), params=params)
                if r.status_code == 404:
                    log_available = False
                    break
                r.raise_for_status()
                data = r.json()
                for rec in data.get("records", []):
                    f = rec.get("fields") or {}
                    logs.append({
                        "slug": f.get("Slug"),
                        "source": f.get("Source") or "direct",
                        "host": f.get("Host"),
                    })
                fetched += len(data.get("records", []))
                offset = data.get("offset")
                if not offset:
                    break
    except Exception:
        log_available = False

    by_source: dict = {}
    by_slug_source: dict = {}
    by_host: dict = {}
    by_slug_host: dict = {}
    for entry in logs:
        s = entry["source"] or "direct"
        by_source[s] = by_source.get(s, 0) + 1
        if entry["slug"]:
            by_slug_source.setdefault(entry["slug"], {})
            by_slug_source[entry["slug"]][s] = by_slug_source[entry["slug"]].get(s, 0) + 1
        if entry.get("host"):
            h = re.sub(r"^www\.", "", entry["host"])
            by_host[h] = by_host.get(h, 0) + 1
            if entry["slug"]:
                by_slug_host.setdefault(entry["slug"], {})
                by_slug_host[entry["slug"]][h] = by_slug_host[entry["slug"]].get(h, 0) + 1

    products.sort(key=lambda x: x["clickCount"], reverse=True)
    return JSONResponse({
        "total": len(products),
        "totalClicks": sum(p["clickCount"] for p in products),
        "records": products,
        "attribution": {
            "available": log_available,
            "logsCount": len(logs),
            "bySource": by_source,
            "bySlugSource": by_slug_source,
            "byHost": by_host,
            "bySlugHost": by_slug_host,
        },
    })


@router.get("/api/qr")
async def qr(slug: str = Query(...), src: str = Query(""), c: str = Query(""),
             request: Request = None):
    slug = (slug or "").strip()
    if not slug:
        return Response("slug required", status_code=400, media_type="text/plain")

    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "bizboogie.com") if request else "bizboogie.com"
    proto = (request.headers.get("x-forwarded-proto") if request else None) or "https"
    params = []
    if src:
        params.append(f"src={urllib.parse.quote(src[:120])}")
    if c:
        params.append(f"c={urllib.parse.quote(c[:120])}")
    qs = ("?" + "&".join(params)) if params else ""
    target = f"{proto}://{host}/go/{urllib.parse.quote(slug)}{qs}"

    img = qrcode.make(target, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'inline; filename="{slug}-qr.png"',
            "X-QR-Target": target,
        },
    )
