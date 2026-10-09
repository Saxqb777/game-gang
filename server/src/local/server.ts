import { existsSync } from 'node:fs';
import { createServer as createHttpServer, type RequestListener, type Server } from 'node:http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https';
import { join } from 'node:path';
import { createApiHandler, type ApiHandler } from '../api/router';
import { createNeonRunner } from '../db/neon';
import { createPgliteRunner } from '../db/pglite';
import { createStore } from '../db/store';
import { readEnv } from '../env';
import { loadDevCert } from './cert';
import { detectLanIp, terminalQr } from './lan';
import { REPO_ROOT } from './paths';

export interface LocalContext {
  api: ApiHandler;
  lanIp: string;
  httpPort: number;
  httpsPort: number;
  databaseLabel: string;
}

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

/** Shared setup for `pnpm dev` and `pnpm start`: env, database, API with terminal QR codes. */
export async function createLocalContext(): Promise<LocalContext> {
  const envFile = join(REPO_ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const env = readEnv();
  const lanIp = detectLanIp();
  const httpPort = Number(process.env.PORT ?? 4000);
  const httpsPort = Number(process.env.HTTPS_PORT ?? 4443);

  const runner = env.databaseUrl ? createNeonRunner(env.databaseUrl) : await createPgliteRunner();
  const api = createApiHandler({
    store: createStore(runner),
    env,
    // Phones always get the HTTPS LAN address: tilt steering needs a secure page.
    padOrigin: () => `https://${lanIp}:${httpsPort}`,
    onRoomCreated: (code, padUrl) => {
      void terminalQr(padUrl).then((qr) => {
        console.log(`\n  ${bold('Room ' + code)}  ${cyan(padUrl)}\n${qr}`);
      });
    },
  });
  return {
    api,
    lanIp,
    httpPort,
    httpsPort,
    databaseLabel: env.databaseUrl
      ? 'Neon (DATABASE_URL)'
      : 'in-memory Postgres (set DATABASE_URL in .env to use Neon)',
  };
}

export interface LocalServers {
  http: Server;
  https: HttpsServer;
  /** Starts listening; everything except /api goes to `app`. */
  listen(app: RequestListener, modeLabel: string): Promise<void>;
}

/**
 * http for the TV on this Mac (localhost is a secure context already) and https for phones on the
 * LAN. Created before Vite so its hot reload websocket can share both ports.
 */
export async function createLocalServers(context: LocalContext): Promise<LocalServers> {
  const cert = await loadDevCert(join(REPO_ROOT, 'node_modules', '.cache', 'gamergang'), context.lanIp);
  let app: RequestListener = (_req, res) => res.writeHead(503).end();
  const handler: RequestListener = (req, res) => {
    if (req.url?.startsWith('/api/')) void context.api(req, res);
    else app(req, res);
  };
  const http = createHttpServer(handler);
  const https = createHttpsServer(cert, handler);
  // Websocket upgrades (Vite hot reload) arriving over TLS are handled by the http server's listeners.
  https.on('upgrade', (req, socket, head) => http.emit('upgrade', req, socket, head));

  return {
    http,
    https,
    async listen(nextApp, modeLabel) {
      app = nextApp;
      await Promise.all([
        new Promise<void>((resolve) => http.listen(context.httpPort, resolve)),
        new Promise<void>((resolve) => https.listen(context.httpsPort, resolve)),
      ]);
      const tvUrl = `http://localhost:${context.httpPort}/tv`;
      const padUrl = `https://${context.lanIp}:${context.httpsPort}/pad`;
      console.log(`
  ${bold('GAMER GANG')} ${dim(modeLabel)}

  TV  (open on this Mac, then put it on the TV):  ${cyan(tvUrl)}
  Pad (phones on the same wifi):                  ${cyan(padUrl)}
  Database: ${context.databaseLabel}

  ${dim('Phones warn about the self-signed certificate once: tap "Show details" -> "visit this website".')}
  ${dim('Each TV page creates a room and its join QR code is printed below.')}
`);
      console.log(await terminalQr(padUrl));
    },
  };
}
