import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from 'pino';

export const MAX_LOG_BODY_BYTES = 64 * 1024;

const LEVELS = { debug: 'debug', log: 'info', info: 'info', warn: 'warn', error: 'error' } as const;
type ClientLevel = keyof typeof LEVELS;
interface ClientLogEntry {
  level: ClientLevel;
  msg: string;
  clientId: string;
  ts: number;
}

const isLevel = (v: unknown): v is ClientLevel => typeof v === 'string' && Object.hasOwn(LEVELS, v);

/** Gövdeyi sonuna kadar okur (bağlantı kopmasın diye); sınırı aşarsa null döner. */
function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    req.on('end', () => resolve(size > limit ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseEntries(body: string): ClientLogEntry[] | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const out: ClientLogEntry[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const { level, msg, clientId, ts } = item as Record<string, unknown>;
    if (!isLevel(level) || typeof msg !== 'string' || typeof clientId !== 'string' || typeof ts !== 'number')
      return null;
    out.push({ level, msg: msg.slice(0, 4000), clientId: clientId.slice(0, 64), ts });
  }
  return out;
}

function status(res: ServerResponse, code: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(code);
    res.end();
    return;
  }
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

/** POST /__log: tarayıcı konsolunu sunucu loguna (dev'de logs/dev.log) yazar. */
export function createDevLogRoute(log: Logger) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.startsWith('application/json')) {
      req.resume();
      return status(res, 415, { error: 'unsupported_media_type' });
    }
    const origin = req.headers.origin;
    if (origin !== undefined && !LOCAL_ORIGIN.test(origin)) {
      req.resume();
      return status(res, 403, { error: 'forbidden_origin' });
    }
    const body = await readBody(req, MAX_LOG_BODY_BYTES);
    if (body === null) return status(res, 413, { error: 'too_large' });
    const entries = parseEntries(body);
    if (!entries) return status(res, 400, { error: 'bad_request' });
    for (const e of entries)
      log.child({ src: 'client', clientId: e.clientId, clientTs: e.ts })[LEVELS[e.level]](e.msg);
    status(res, 204);
  };
}
