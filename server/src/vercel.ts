/**
 * Vercel function entry. scripts/build-vercel.mjs bundles this file into the single /api function,
 * so every /api/* route shares one warm instance.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestOrigin, sendJson } from './api/http';
import { createApiHandler, type ApiHandler } from './api/router';
import { createNeonRunner } from './db/neon';
import { createStore } from './db/store';
import { readEnv } from './env';

const env = readEnv();
let api: ApiHandler | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!env.databaseUrl) {
    sendJson(res, 500, { error: 'DATABASE_URL is not configured on this deployment' });
    return;
  }
  api ??= createApiHandler({
    store: createStore(createNeonRunner(env.databaseUrl)),
    env,
    padOrigin: requestOrigin,
  });
  await api(req, res);
}
