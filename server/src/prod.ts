/** `pnpm start`: serves the production build from client/dist plus /api, on this Mac. */
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { REPO_ROOT } from './local/paths';
import { createLocalContext, createLocalServers } from './local/server';

const DIST = join(REPO_ROOT, 'client', 'dist');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.md': 'text/plain; charset=utf-8',
};

function sendFile(res: ServerResponse, file: string, cacheControl: string): void {
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': cacheControl,
  });
  createReadStream(file).pipe(res);
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const file = normalize(join(DIST, pathname));
  if (!file.startsWith(DIST + sep)) {
    res.writeHead(403).end();
    return;
  }
  const info = await stat(file).catch(() => null);
  if (info?.isFile()) {
    // Vite fingerprints everything under /assets, so those never change.
    const immutable = pathname.startsWith('/assets/');
    sendFile(res, file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    return;
  }
  if (!extname(pathname)) {
    sendFile(res, join(DIST, 'index.html'), 'no-cache');
    return;
  }
  res.writeHead(404).end();
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('client/dist is missing. Run `pnpm start` (it builds first) or `pnpm build`.');
  process.exit(1);
}

const context = await createLocalContext();
const servers = await createLocalServers(context);
await servers.listen((req, res) => void serveStatic(req, res), 'production build');
