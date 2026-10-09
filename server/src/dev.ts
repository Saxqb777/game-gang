/** `pnpm dev`: Vite with hot reload for the client, plus the same /api handlers that run on Vercel. */
import { join } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { REPO_ROOT } from './local/paths';
import { createLocalContext, createLocalServers } from './local/server';

const context = await createLocalContext();
const servers = await createLocalServers(context);
const clientRoot = join(REPO_ROOT, 'client');
const vite = await createViteServer({
  root: clientRoot,
  configFile: join(clientRoot, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: { server: servers.http } },
  appType: 'spa',
});

await servers.listen((req, res) => vite.middlewares(req, res), 'dev (hot reload)');
