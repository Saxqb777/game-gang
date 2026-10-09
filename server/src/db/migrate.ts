/** `pnpm db:migrate`: create the tables up front. Optional - the API also creates them on first use. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../local/paths';
import { readEnv } from '../env';
import { createNeonRunner } from './neon';
import { SCHEMA } from './schema';

const envFile = join(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { databaseUrl } = readEnv();
if (!databaseUrl) {
  console.error('DATABASE_URL is not set (add it to .env).');
  process.exit(1);
}
await createNeonRunner(databaseUrl).batch(SCHEMA);
console.log('Schema is up to date.');
