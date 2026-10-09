/**
 * Builds the Vercel deployment in Build Output API v3 format (.vercel/output):
 *   static/                 the Vite client build
 *   functions/api/room.func the API, bundled by esbuild into one CommonJS file
 *   functions/api/*.func    symlinks to room.func, so all routes share one warm function
 * Vercel picks up .vercel/output automatically after the build command.
 */
import { execSync } from 'node:child_process';
import { cp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const OUT = '.vercel/output';
const API_ROUTES = ['room', 'signal', 'laps'];
const [mainRoute, ...aliasRoutes] = API_ROUTES;

await rm(OUT, { recursive: true, force: true });

execSync('pnpm --filter @gamergang/client build', { stdio: 'inherit' });
await cp('client/dist', `${OUT}/static`, { recursive: true });

const functionDir = `${OUT}/functions/api/${mainRoute}.func`;
await mkdir(functionDir, { recursive: true });
await build({
  entryPoints: ['server/src/vercel.ts'],
  outfile: `${functionDir}/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
  keepNames: true,
  // Expose the default export as the module itself for the Node launcher.
  footer: { js: 'module.exports = module.exports.default; module.exports.default = module.exports;' },
  logLevel: 'info',
});
// The bundle is CommonJS; say so explicitly so no parent package.json can make Node treat it as ESM.
await writeFile(`${functionDir}/package.json`, JSON.stringify({ type: 'commonjs' }));
await writeFile(
  `${functionDir}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      maxDuration: 10,
    },
    null,
    2,
  ),
);
for (const route of aliasRoutes) {
  await symlink(`${mainRoute}.func`, `${OUT}/functions/api/${route}.func`);
}

await writeFile(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '^/assets/(.*)$',
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        { handle: 'filesystem' },
        // Unknown API paths 404 instead of falling through to the SPA.
        { src: '^/api/.*$', status: 404 },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log(`\nVercel output ready in ${OUT}`);
