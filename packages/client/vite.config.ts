import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/health': 'http://localhost:3000',
      '/rooms': 'http://localhost:3000',
      '/__log': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    // three ayrı chunk (M0 backlog). Vite 8.3 / Rolldown 1.2: nesne biçimli manualChunks desteklenmez;
    // tiplenen yol output.codeSplitting.groups (rolldownOptions).
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }] },
      },
    },
  },
});
