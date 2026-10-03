import { PROTOCOL_VERSION, decodeServerMessage, encode } from '@gg/protocol';

export type NetStatus = 'connecting' | 'open' | 'closed' | 'version_mismatch';

export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
}

export interface ConnectionOptions {
  url: string;
  createSocket?: (url: string) => SocketLike;
  schedule?: (fn: () => void, ms: number) => unknown;
  onStatus?: (status: NetStatus) => void;
}

export interface Connection {
  readonly status: NetStatus;
  readonly clientId: string | null;
  readonly attempts: number;
  close(): void;
}

export const BACKOFF_MS = [500, 1000, 2000, 4000, 8000, 10000];

export function connect(o: ConnectionOptions): Connection {
  const createSocket = o.createSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  const schedule = o.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  let status: NetStatus = 'connecting';
  let clientId: string | null = null;
  let attempts = 0;
  let stopped = false;
  let socket: SocketLike | null = null;

  const setStatus = (s: NetStatus) => {
    status = s;
    o.onStatus?.(s);
  };

  const open = () => {
    if (stopped) return; // close() bekleyen yeniden denemeyi de iptal eder
    setStatus('connecting');
    const s = createSocket(o.url);
    socket = s;
    s.onopen = () => s.send(encode({ t: 'hello', protocolVersion: PROTOCOL_VERSION }));
    s.onmessage = (ev) => {
      const m = typeof ev.data === 'string' ? decodeServerMessage(ev.data) : null;
      if (!m) return;
      if (m.t === 'welcome') {
        clientId = m.clientId;
        attempts = 0;
        setStatus('open');
      } else if (m.t === 'error' && m.code === 'version_mismatch') {
        stopped = true;
        setStatus('version_mismatch');
      }
    };
    s.onclose = () => {
      socket = null;
      clientId = null;
      if (status === 'version_mismatch') return;
      setStatus('closed');
      if (stopped) return;
      const delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? 10000;
      attempts++;
      schedule(open, delay);
    };
  };

  open();
  return {
    get status() {
      return status;
    },
    get clientId() {
      return clientId;
    },
    get attempts() {
      return attempts;
    },
    close() {
      stopped = true;
      if (socket) socket.close();
      else setStatus('closed');
    },
  };
}
