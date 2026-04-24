// GET /go/:slug -> looks up slug in Airtable, redirects to Affiliate Link.
// Fire-and-forget increments "Click Count" and stamps "Last Clicked" (fields optional).
const Airtable = require('airtable');

const FALLBACK = process.env.FALLBACK_URL || 'https://bizboogie.com';
const TABLE = process.env.AIRTABLE_TABLE || 'Affiliate Products';

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

module.exports = async (req, res) => {
  const slug = (req.query && req.query.slug ? String(req.query.slug) : '').trim().toLowerCase();

  if (!slug) return redirect(res, FALLBACK);

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) return redirect(res, `${FALLBACK}?error=missing_env`);

  try {
    const base = new Airtable({ apiKey: token }).base(baseId);
    // Airtable formula: case-insensitive exact match on Slug
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

    // Fire-and-forget click tracking. Ignore if fields don't exist.
    const current = Number(rec.get('Click Count') || 0);
    base(TABLE)
      .update(rec.id, {
        'Click Count': current + 1,
        'Last Clicked': new Date().toISOString(),
      })
      .catch((err) => {
        if (err && err.error !== 'UNKNOWN_FIELD_NAME') {
          console.error('Click tracking failed:', err.message || err);
        }
      });

    if (!link) return redirect(res, '/not-found.html?slug=' + encodeURIComponent(slug) + '&reason=no_link');
    return redirect(res, String(link));
  } catch (error) {
    console.error('Airtable error:', error && error.message ? error.message : error);
    return redirect(res, `${FALLBACK}?error=lookup_failed`);
  }
};
