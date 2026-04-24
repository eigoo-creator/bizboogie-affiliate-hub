// Local dev harness that simulates Vercel's routing defined in vercel.json.
// Not used in production (Vercel runs /api/* and static files natively).
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const staticMap = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/not-found.html': 'not-found.html',
  '/admin': 'admin.html',
  '/admin.html': 'admin.html',
};

function serveStatic(res, file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(p));
}

async function runApi(name, req, res, query) {
  try {
    delete require.cache[require.resolve(`./api/${name}.js`)];
    const handler = require(`./api/${name}.js`);
    req.query = query;
    await handler(req, res);
  } catch (e) {
    console.error('API crash:', e);
    if (!res.headersSent) { res.writeHead(500); res.end('crash: ' + e.message); }
  }
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  const pathname = u.pathname;

  // /go/:slug  (vercel rewrite)
  const goMatch = pathname.match(/^\/go\/([^\/]+)\/?$/);
  if (goMatch) return runApi('go', req, res, { slug: decodeURIComponent(goMatch[1]) });

  // /api/:name
  const apiMatch = pathname.match(/^\/api\/([a-z0-9_-]+)$/i);
  if (apiMatch) return runApi(apiMatch[1], req, res, u.query);

  if (staticMap[pathname]) return serveStatic(res, staticMap[pathname]);

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404');
});

server.listen(PORT, '0.0.0.0', () => console.log(`dev server http://0.0.0.0:${PORT}`));
