// Lokale statische server voor de demo: / → demo/index.html, /engine/* → engine/*, rest → demo/*.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = path.join(ROOT, 'demo');
const ENGINE = path.join(ROOT, 'engine');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function zoekBestand(urlPad) {
  let pad;
  try { pad = decodeURIComponent(urlPad.split('?')[0]); } catch { return null; }
  if (pad.includes('\0')) return null;
  if (pad === '/' || pad === '') return path.join(DEMO, 'index.html');
  const [basis, rest] = pad.startsWith('/engine/') ? [ENGINE, pad.slice('/engine/'.length)] : [DEMO, pad.slice(1)];
  const doel = path.resolve(basis, rest);
  return doel.startsWith(basis + path.sep) ? doel : null;
}

const server = http.createServer(async (req, res) => {
  const bestand = zoekBestand(req.url || '/');
  const type = bestand && TYPES[path.extname(bestand).toLowerCase()];
  if (!type) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Niet gevonden'); return; }
  try {
    const data = await readFile(bestand);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Niet gevonden');
  }
});

server.listen(PORT, () => console.log(`RollNest demo: http://localhost:${PORT}/`));
