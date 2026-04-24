// GET /api/admin?password=…
// Returns JSON: records (per-slug), totals, attribution (per-source, per-slug-per-source).
const Airtable = require('airtable');

const TABLE = process.env.AIRTABLE_TABLE || 'Affiliate Products';
const LOG_TABLE = process.env.AIRTABLE_LOG_TABLE || 'Click Log';
const LOG_LIMIT = 2000; // cap to keep response fast

module.exports = async (req, res) => {
  const pw = (req.headers && req.headers['x-admin-password']) || (req.query && req.query.password) || '';
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ADMIN_PASSWORD not configured' }));
    return;
  }
  if (pw !== expected) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'missing airtable env' }));
    return;
  }

  try {
    const base = new Airtable({ apiKey: token }).base(baseId);

    // --- Products ---
    const products = [];
    await base(TABLE)
      .select({ pageSize: 100 })
      .eachPage((records, next) => {
        records.forEach((r) => {
          products.push({
            id: r.id,
            slug: r.get('Slug') || null,
            productName: r.get('Product Name') || null,
            affiliateLink: r.get('Affiliate Link') || null,
            category: r.get('Category') || null,
            mission: r.get('Mission') || null,
            platform: r.get('Platform') || null,
            commissionTier: r.get('Commission Tier') || null,
            approved: r.get('Agent Z Approved') === true,
            clickCount: Number(r.get('Click Count') || 0),
            lastClicked: r.get('Last Clicked') || null,
            lastSource: r.get('Last Source') || null,
          });
        });
        next();
      });

    // --- Click Log (optional table, graceful degradation) ---
    let logAvailable = true;
    const logs = [];
    try {
      await base(LOG_TABLE)
        .select({ pageSize: 100, maxRecords: LOG_LIMIT, sort: [{ field: 'Clicked At', direction: 'desc' }] })
        .eachPage((records, next) => {
          records.forEach((r) => {
            logs.push({
              id: r.id,
              slug: r.get('Slug') || null,
              source: r.get('Source') || 'direct',
              campaign: r.get('Campaign') || null,
              clickedAt: r.get('Clicked At') || null,
              country: r.get('Country') || null,
            });
          });
          next();
        });
    } catch (err) {
      logAvailable = false;
    }

    // --- Aggregate attribution ---
    const bySource = {};
    const bySlugSource = {};
    logs.forEach((l) => {
      const src = l.source || 'direct';
      bySource[src] = (bySource[src] || 0) + 1;
      if (l.slug) {
        if (!bySlugSource[l.slug]) bySlugSource[l.slug] = {};
        bySlugSource[l.slug][src] = (bySlugSource[l.slug][src] || 0) + 1;
      }
    });

    const totalClicks = products.reduce((s, x) => s + x.clickCount, 0);

    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(
      JSON.stringify(
        {
          total: products.length,
          totalClicks,
          records: products.sort((a, b) => b.clickCount - a.clickCount),
          attribution: {
            available: logAvailable,
            logsCount: logs.length,
            bySource,
            bySlugSource,
          },
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error('Admin lookup failed:', err && err.message ? err.message : err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'lookup_failed', detail: String((err && err.message) || err) }));
  }
};
