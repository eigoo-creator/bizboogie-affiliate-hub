// GET /api/admin -> JSON dump of all affiliate records + click stats.
// Auth: header "x-admin-password" OR query "?password=" must match ADMIN_PASSWORD env.
const Airtable = require('airtable');

const TABLE = process.env.AIRTABLE_TABLE || 'Affiliate Products';

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
    const all = [];
    await base(TABLE)
      .select({ pageSize: 100 })
      .eachPage((records, next) => {
        records.forEach((r) => {
          all.push({
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
          });
        });
        next();
      });

    const totalClicks = all.reduce((s, x) => s + x.clickCount, 0);

    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(
      JSON.stringify({
        total: all.length,
        totalClicks,
        records: all.sort((a, b) => b.clickCount - a.clickCount),
      }, null, 2)
    );
  } catch (err) {
    console.error('Admin lookup failed:', err && err.message ? err.message : err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'lookup_failed', detail: String(err && err.message || err) }));
  }
};
