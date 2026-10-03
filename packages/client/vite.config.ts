import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/health': 'http://localhost:3000',
      '/__log': 'http://localhost:3000',
    },
  },
  build: { outDir: '../../dist/client', emptyOutDir: true, target: 'es2022' },
});
