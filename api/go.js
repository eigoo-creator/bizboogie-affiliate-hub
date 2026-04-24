// GET /go/:slug?src=ig&c=spring-drop
// Looks up slug in Airtable, 302 redirects to Affiliate Link.
// Fire-and-forget:
//   * increments "Click Count"
//   * stamps "Last Clicked"
//   * stamps "Last Source" (optional field)
//   * creates a "Click Log" record (optional table) with Slug/Source/Campaign/Clicked At/Referer/User Agent/Country
// Any missing field or table is silently tolerated.
const Airtable = require('airtable');

const FALLBACK = process.env.FALLBACK_URL || 'https://bizboogie.com';
const TABLE = process.env.AIRTABLE_TABLE || 'Affiliate Products';
const LOG_TABLE = process.env.AIRTABLE_LOG_TABLE || 'Click Log';

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function pick(v, max = 500) {
  if (!v) return '';
  return String(v).slice(0, max);
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const slug = (q.slug ? String(q.slug) : '').trim().toLowerCase();
  const src = pick(q.src, 64).toLowerCase().replace(/[^a-z0-9_\-]/g, '') || 'direct';
  const campaign = pick(q.c || q.campaign, 120);

  if (!slug) return redirect(res, FALLBACK);

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) return redirect(res, `${FALLBACK}?error=missing_env`);

  try {
    const base = new Airtable({ apiKey: token }).base(baseId);
    const records = await base(TABLE)
      .select({
        maxRecords: 1,
        filterByFormula: `LOWER({Slug})="${slug.replace(/"/g, '\\"')}"`,
      })
      .firstPage();

    if (!records || records.length === 0) {
      return redirect(res, '/not-found.html?slug=' + encodeURIComponent(slug));
    }

    const rec = records[0];
    const link = rec.get('Affiliate Link');

    // --- Fire-and-forget attribution writes ---
    const nowIso = new Date().toISOString();
    const referer = pick(req.headers['referer'] || req.headers['referrer'], 500);
    const ua = pick(req.headers['user-agent'], 500);
    const country = pick(
      req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '',
      8
    );

    // 1) Per-row counters (retry without optional field on UNKNOWN_FIELD_NAME)
    const current = Number(rec.get('Click Count') || 0);
    const fullPatch = {
      'Click Count': current + 1,
      'Last Clicked': nowIso,
      'Last Source': src,
    };
    base(TABLE).update(rec.id, fullPatch).catch((err) => {
      if (err && err.error === 'UNKNOWN_FIELD_NAME') {
        // Retry without Last Source
        const { ['Last Source']: _drop, ...rest } = fullPatch;
        base(TABLE).update(rec.id, rest).catch((err2) => {
          if (err2 && err2.error !== 'UNKNOWN_FIELD_NAME') {
            console.error('counter update failed:', err2.message || err2);
          }
        });
      } else if (err) {
        console.error('counter update failed:', err.message || err);
      }
    });

    // 2) Click Log record (if table exists)
    base(LOG_TABLE)
      .create([
        {
          fields: {
            Slug: slug,
            Source: src,
            Campaign: campaign,
            'Clicked At': nowIso,
            Referer: referer,
            'User Agent': ua,
            Country: country,
          },
        },
      ])
      .catch((err) => {
        // NOT_FOUND -> table doesn't exist; UNKNOWN_FIELD_NAME -> missing columns; both are fine.
        if (err && !['NOT_FOUND', 'UNKNOWN_FIELD_NAME', 'TABLE_NOT_FOUND'].includes(err.error)) {
          console.error('click log failed:', err.message || err);
        }
      });

    if (!link) {
      return redirect(res, '/not-found.html?slug=' + encodeURIComponent(slug) + '&reason=no_link');
    }
    return redirect(res, String(link));
  } catch (error) {
    console.error('Airtable error:', error && error.message ? error.message : error);
    return redirect(res, `${FALLBACK}?error=lookup_failed`);
  }
};
