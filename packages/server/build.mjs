import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  outfile: '../../dist/server/server.mjs',
  // ws'in isteğe bağlı yerel hızlandırıcıları; yoksa ws saf JS'e düşer.
  external: ['bufferutil', 'utf-8-validate'],
  // pino ve ws CommonJS; ESM paket içinde require'ı sağlıyoruz.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  // Derleme sabiti: app.ts'teki dev dalı (dev-log modülü dahil) ölü kod olarak atılır.
  define: { 'process.env.NODE_ENV': '"production"' },
  minifySyntax: true,
  legalComments: 'none',
  logLevel: 'info',
});
