import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'dist');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const requested = decodeURIComponent(url.pathname);
    const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT)) throw new Error('Poza katalogiem');
    const info = await stat(file);
    const target = info.isDirectory() ? path.join(file, 'index.html') : file;
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nie znaleziono');
  }
}).listen(PORT, () => {
  console.log(`Gazeta działa pod adresem http://localhost:${PORT}`);
});
