import { defineConfig } from 'vite';
import { handleCover } from './server/cover-proxy.mjs';

// Same /cover image proxy as the production server, for `npm run dev` and `vite preview`.
const coverProxy = () => {
  const use = (server) => {
    server.middlewares.use((req, res, next) => (req.url?.startsWith('/cover?') || req.url === '/cover' ? handleCover(req, res) : next()));
  };
  return { name: 'cover-proxy', configureServer: use, configurePreviewServer: use };
};

export default defineConfig({
  plugins: [coverProxy()],
  // three.js alone is ~550 kB minified; that's expected for this app.
  build: { chunkSizeWarningLimit: 800 },
});
