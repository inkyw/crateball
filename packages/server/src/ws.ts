import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { Logger } from 'pino';
import { WebSocketServer } from 'ws';
import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  decodeClientMessage,
  encode,
  type ServerMessage,
} from '@gg/protocol';

export const HELLO_TIMEOUT_MS = 5000;
export const CLOSE_HELLO_TIMEOUT = 4000;
export const CLOSE_VERSION_MISMATCH = 4001;

export function attachWebSocket(
  server: Server,
  log: Logger,
  opts: { helloTimeoutMs?: number } = {},
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });
  wss.on('connection', (socket) => {
    const clientId = randomUUID().slice(0, 8);
    const clog = log.child({ clientId });
    const send = (m: ServerMessage) => socket.send(encode(m));
    let greeted = false;
    const timer = setTimeout(() => {
      if (!greeted) socket.close(CLOSE_HELLO_TIMEOUT, 'hello timeout');
    }, opts.helloTimeoutMs ?? HELLO_TIMEOUT_MS);

    socket.on('close', (code) => {
      clearTimeout(timer);
      clog.info({ code }, 'ws kapandı');
    });
    socket.on('error', (err) => clog.warn({ err }, 'ws hatası'));
    socket.on('message', (data, isBinary) => {
      const msg = isBinary ? null : decodeClientMessage(data.toString());
      if (!msg) {
        clog.warn('bozuk mesaj atıldı');
        send({ t: 'error', code: 'bad_message', message: 'Could not read message' });
        return;
      }
      if (msg.t === 'hello') {
        if (msg.protocolVersion !== PROTOCOL_VERSION) {
          clog.warn({ theirs: msg.protocolVersion, ours: PROTOCOL_VERSION }, 'sürüm uyuşmazlığı');
          send({ t: 'error', code: 'version_mismatch', message: 'The game was updated — reload the page' });
          socket.close(CLOSE_VERSION_MISMATCH, 'version mismatch');
          return;
        }
        greeted = true;
        clearTimeout(timer);
        clog.info('oyuncu bağlandı');
        send({ t: 'welcome', protocolVersion: PROTOCOL_VERSION, clientId, serverTime: Date.now() });
        return;
      }
      if (!greeted) {
        send({ t: 'error', code: 'bad_message', message: 'Send hello first' });
        return;
      }
      if (msg.t === 'ping') send({ t: 'pong', id: msg.id, serverTime: Date.now() });
    });
  });
  return wss;
}
