import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // HDRI, car model, textures and sounds live in /assets at the repo root (see assets/ASSETS.md).
  publicDir: '../assets',
  build: {
    target: 'es2022',
    // three.js + Rapier (with its embedded WASM) are big by nature; they only load on /tv.
    chunkSizeWarningLimit: 3000,
  },
});
