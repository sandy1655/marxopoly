import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow tunnelled hosts (e.g. *.ngrok-free.app) to reach the dev server.
    // For sharing a game, prefer `pnpm share` — it serves everything through
    // the Node server on one ngrok tunnel.
    allowedHosts: true,
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
