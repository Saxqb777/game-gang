import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** The commit this build came from, for telemetry: Vercel's SHA, else local git, else 'local'. */
function buildId(): string {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercel) return vercel.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .slice(0, 12);
  } catch {
    return 'local';
  }
}

export default defineConfig({
  plugins: [react()],
  // HDRI, car model, textures and sounds live in /assets at the repo root (see assets/ASSETS.md).
  publicDir: '../assets',
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId() || 'local') },
  build: {
    target: 'es2022',
    // three.js + Rapier (with its embedded WASM) are big by nature; they only load on /tv.
    chunkSizeWarningLimit: 3000,
  },
});
