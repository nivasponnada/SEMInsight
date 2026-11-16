import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative base so the build works from any sub-path (e.g. GitHub Pages project sites).
const page = (f) => resolve(import.meta.dirname, f);
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: { index: page('index.html'), sem: page('sem.html'), tem: page('tem.html'), xrd: page('xrd.html'), semiconductor: page('semiconductor.html') } },
  },
});
