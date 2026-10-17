import { defineConfig } from 'vite';

export default defineConfig({
  // three.js alone is ~550 kB minified; that's expected for this app.
  build: { chunkSizeWarningLimit: 800 },
});
