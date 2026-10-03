import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pino, { type Logger } from 'pino';
import type { ServerConfig } from './config';

export function createLogger(
  cfg: ServerConfig,
  opts: { level?: pino.Level; stdout?: NodeJS.WritableStream } = {},
): Logger {
  // Dev'de tarayıcıdaki console.debug da dosyaya ulaşsın diye varsayılan debug.
  const level =
    opts.level ?? (process.env.LOG_LEVEL as pino.Level | undefined) ?? (cfg.logFile ? 'debug' : 'info');
  const stdout = opts.stdout ?? process.stdout;
  if (!cfg.logFile) return pino({ level }, stdout);
  mkdirSync(dirname(cfg.logFile), { recursive: true });
  const file = pino.destination({ dest: cfg.logFile, sync: true });
  // multistream akışlarının varsayılan seviyesi info; logger seviyesiyle eşitlemezsek debug elenir.
  return pino(
    { level },
    pino.multistream([
      { level, stream: stdout },
      { level, stream: file },
    ]),
  );
}
