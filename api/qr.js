// GET /api/qr?slug=foo&src=ig&c=spring-drop
// Returns PNG QR code of the absolute /go/:slug?src=…&c=… URL (preserves attribution).
const QRCode = require('qrcode');

function esc(v) {
  return encodeURIComponent(String(v).slice(0, 120));
}

module.exports = async (req, res) => {
  const slug = (req.query && req.query.slug ? String(req.query.slug) : '').trim();
  if (!slug) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('slug required');
    return;
  }
  const src = (req.query && (req.query.src || '')).toString().trim();
  const campaign = (req.query && (req.query.c || req.query.campaign || '')).toString().trim();

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'bizboogie.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const params = [];
  if (src) params.push(`src=${esc(src)}`);
  if (campaign) params.push(`c=${esc(campaign)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const target = `${proto}://${host}/go/${encodeURIComponent(slug)}${qs}`;

  try {
    const buf = await QRCode.toBuffer(target, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#0a0f1e', light: '#ffffff' },
    });
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': `inline; filename="${slug}${src ? '-' + src : ''}-qr.png"`,
      'X-QR-Target': target,
    });
    res.end(buf);
  } catch (err) {
    console.error('QR error:', err && err.message ? err.message : err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('qr_failed');
  }
};
