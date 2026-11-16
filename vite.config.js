import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (e.g. GitHub Pages project sites).
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 900 } });
