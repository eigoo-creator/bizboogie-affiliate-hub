# Test Credentials — BizBoogie Affiliate Hub

## Admin dashboard (/admin)
- Password: `REDACTED_ADMIN_PW` (env: `ADMIN_PASSWORD` in /app/.env)
- URL (preview): https://e7dacabf-5c22-406e-94ad-2555e7ec4650.preview.emergentagent.com/admin
- API: GET /api/admin?password=REDACTED_ADMIN_PW

## Airtable (for reference)
- Base: appcAUcJQ5lEBTv7D
- Table: Affiliate Products
- Token: stored in /app/.env as AIRTABLE_TOKEN (has data.records:read + data.records:write; no schema write)

## Live slug for testing
- /go/agent-z-rig → https://www.amazon.com/raspberry-pi-5?tag=eigoo0fa-20
- /go/bogus → 302 to /not-found.html
