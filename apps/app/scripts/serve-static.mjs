import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = normalize(new URL('../dist/', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const port = Number(process.argv[2] || 4174);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', `http://${request.headers.host}`).pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const candidates = extname(relative) ? [relative] : [`${relative}.html`, join(relative, 'index.html')];
  const file = candidates.map((candidate) => normalize(join(root, candidate))).find((candidate) => candidate.startsWith(root) && existsSync(candidate));

  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1');
