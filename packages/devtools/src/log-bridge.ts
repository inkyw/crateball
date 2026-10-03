export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  msg: string;
  clientId: string;
  ts: number;
}

export const MAX_MSG_CHARS = 2000;
/** Sunucu 64 KB'ı reddeder; düşürme uyarısı ve dizi zarfı için pay bırakıyoruz. */
export const MAX_BATCH_BYTES = 48 * 1024;
export const SEND_TIMEOUT_MS = 5000;
const LEVELS: readonly LogLevel[] = ['debug', 'log', 'info', 'warn', 'error'];
const encoder = new TextEncoder();

export function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack ?? `${a.name}: ${a.message}`;
      try {
        return JSON.stringify(a) ?? String(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .slice(0, MAX_MSG_CHARS);
}

export interface LogBatcherOptions {
  clientId: string;
  send: (entries: LogEntry[]) => Promise<void>;
  flushMs?: number;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
}

export interface LogBatcher {
  push(level: LogLevel, args: unknown[]): void;
  flush(): Promise<void>;
  readonly pendingBytes: number;
}

export function createLogBatcher(o: LogBatcherOptions): LogBatcher {
  const flushMs = o.flushMs ?? 500;
  const now = o.now ?? Date.now;
  const schedule = o.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  let buf: LogEntry[] = [];
  let bytes = 0;
  let dropped = 0;
  let scheduled = false;
  let inflight = false;

  const arm = () => {
    if (scheduled) return;
    scheduled = true;
    schedule(() => void flush(), flushMs);
  };

  const flush = async (): Promise<void> => {
    scheduled = false;
    // Aynı anda tek gönderim: önceki bitmediyse tamponu koru, sonra tekrar dene.
    if (inflight) return arm();
    if (dropped > 0) {
      buf.push({
        level: 'warn',
        msg: `[log-bridge] ${dropped} entries dropped (logging too fast)`,
        clientId: o.clientId,
        ts: now(),
      });
      dropped = 0;
    }
    if (buf.length === 0) return;
    const batch = buf;
    buf = [];
    bytes = 0;
    inflight = true;
    try {
      await o.send(batch);
    } catch {
      // Sunucu yoksa sessizce vazgeç: köprü kendi hatasını loglarsa sonsuz döngüye girer.
    } finally {
      inflight = false;
    }
  };

  return {
    push(level, args) {
      const entry: LogEntry = { level, msg: formatArgs(args), clientId: o.clientId, ts: now() };
      // Gerçek gövde boyutu: JSON kaçışları (\u0000, \\, \") ve UTF-8 dahil, +1 dizi virgülü.
      const size = encoder.encode(JSON.stringify(entry)).length + 1;
      if (bytes + size > MAX_BATCH_BYTES) dropped++;
      else {
        buf.push(entry);
        bytes += size;
      }
      arm();
    },
    flush,
    get pendingBytes() {
      return bytes;
    },
  };
}

export interface InstallLogBridgeOptions {
  endpoint: string;
  clientId: string;
  target?: Pick<Console, LogLevel>;
  win?: Pick<Window, 'addEventListener'>;
  fetchFn?: typeof fetch;
}

/** Tarayıcı konsolunu ve yakalanmamış hataları sunucudaki logs/dev.log dosyasına akıtır (sadece dev). */
export function installLogBridge(o: InstallLogBridgeOptions): LogBatcher {
  const target = o.target ?? console;
  const fetchFn = o.fetchFn ?? fetch.bind(globalThis);
  const batcher = createLogBatcher({
    clientId: o.clientId,
    send: async (entries) => {
      await fetchFn(o.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entries),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    },
  });
  for (const level of LEVELS) {
    const original = target[level].bind(target);
    target[level] = (...args: unknown[]) => {
      original(...args);
      batcher.push(level, args);
    };
  }
  const win = o.win ?? window;
  win.addEventListener('error', (e) => {
    const ev = e as ErrorEvent;
    batcher.push('error', [ev.error ?? ev.message]);
  });
  win.addEventListener('unhandledrejection', (e) => {
    batcher.push('error', ['unhandledrejection', (e as PromiseRejectionEvent).reason]);
  });
  return batcher;
}
