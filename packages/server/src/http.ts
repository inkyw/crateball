import type { IncomingMessage, ServerResponse } from 'node:http';
import sirv from 'sirv';
import type { ServerConfig } from './config';

export type Route = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/** devLog: sadece dev'de verilir (app.ts); prod'da null. */
export function createHttpHandler(cfg: ServerConfig, devLog: Route | null) {
  const assets = cfg.staticDir ? sirv(cfg.staticDir, { single: true, etag: true }) : null;
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end();
        return;
      }
      json(res, 200, { ok: true, version: cfg.version, mode: cfg.mode });
      return;
    }
    if (process.env.NODE_ENV !== 'production' && pathname === '/__log' && req.method === 'POST' && devLog)
      return devLog(req, res);
    // Statik servis (ve SPA fallback) sadece GET/HEAD; diğer her şey açıkça 404.
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 404, { error: 'not_found' });
    if (assets) {
      assets(req, res, () => json(res, 404, { error: 'not_found' }));
      return;
    }
    json(res, 404, { error: 'not_found' });
  };
}
