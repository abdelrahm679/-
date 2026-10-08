// ORION · static dev server (no deps, offline capable)
// Usage: node server.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8321);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '') p = '/index.html';
  const abs = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!abs.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('404 ' + p);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache, no-store, must-revalidate',
      'access-control-allow-origin': '*',
    });
    fs.createReadStream(abs).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ORION platform serving ${ROOT}`);
  console.log(`  → http://${HOST}:${PORT}/`);
});