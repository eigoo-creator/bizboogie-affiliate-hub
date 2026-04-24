// GET /api/qr?slug=foo -> returns PNG QR of the absolute /go/:slug URL.
const QRCode = require('qrcode');

module.exports = async (req, res) => {
  const slug = (req.query && req.query.slug ? String(req.query.slug) : '').trim();
  if (!slug) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('slug required');
    return;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'bizboogie.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const target = `${proto}://${host}/go/${encodeURIComponent(slug)}`;

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
      'Content-Disposition': `inline; filename="${slug}-qr.png"`,
    });
    res.end(buf);
  } catch (err) {
    console.error('QR error:', err && err.message ? err.message : err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('qr_failed');
  }
};
