import {
  PROTOCOL_VERSION,
  decodeServerMessage,
  encode,
  type ClientMessage,
  type ServerMessage,
} from '@crateball/protocol';

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
  /** Every decoded message after the welcome handshake. */
  onMessage?: (m: ServerMessage) => void;
  /** The server's release, from the welcome handshake. */
  onServerVersion?: (version: string) => void;
}

export interface Connection {
  readonly status: NetStatus;
  readonly clientId: string | null;
  readonly attempts: number;
  send(m: ClientMessage): void;
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
  const queued: ClientMessage[] = [];

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
        if (m.version) o.onServerVersion?.(m.version);
        attempts = 0;
        setStatus('open');
        for (const q of queued.splice(0)) s.send(encode(q));
      } else if (m.t === 'error' && m.code === 'version_mismatch') {
        stopped = true;
        setStatus('version_mismatch');
      } else o.onMessage?.(m);
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
    send(m) {
      if (socket && status === 'open') socket.send(encode(m));
      // A click before the handshake finishes (slow link) must not vanish; per-tick traffic is dropped.
      else if (m.t !== 'in' && m.t !== 'ping') queued.push(m);
    },
    close() {
      stopped = true;
      if (socket) socket.close();
      else setStatus('closed');
    },
  };
}
