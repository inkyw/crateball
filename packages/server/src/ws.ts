import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { Logger } from 'pino';
import { WebSocketServer } from 'ws';
import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  decodeClientMessage,
  encode,
  type ErrorCode,
  type ServerMessage,
} from '@crateball/protocol';
import type { Rooms } from './rooms';

export const HELLO_TIMEOUT_MS = 5000;
export const CLOSE_HELLO_TIMEOUT = 4000;
export const CLOSE_VERSION_MISMATCH = 4001;

const ERROR_TEXT: Record<ErrorCode, string> = {
  version_mismatch: 'The game was updated — reload the page',
  bad_message: 'Could not read message',
  room_full: 'This room is full',
  room_not_found: 'Room not found — check the code',
  not_host: 'Only the host can do that',
};

export function attachWebSocket(
  server: Server,
  log: Logger,
  rooms: Rooms,
  opts: { helloTimeoutMs?: number } = {},
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });
  wss.on('connection', (socket) => {
    const clientId = randomUUID().slice(0, 8);
    const clog = log.child({ clientId });
    const send = (m: ServerMessage) => sendRaw(encode(m));
    const sendRaw = (raw: string) => {
      if (socket.readyState === socket.OPEN) socket.send(raw);
    };
    const fail = (code: ErrorCode | null) => {
      if (code) send({ t: 'error', code, message: ERROR_TEXT[code] });
    };
    let greeted = false;
    let lastStatsAt = 0;
    const timer = setTimeout(() => {
      if (!greeted) socket.close(CLOSE_HELLO_TIMEOUT, 'hello timeout');
    }, opts.helloTimeoutMs ?? HELLO_TIMEOUT_MS);

    socket.on('close', (code) => {
      clearTimeout(timer);
      rooms.leave(clientId);
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
      switch (msg.t) {
        case 'ping':
          send({ t: 'pong', id: msg.id, serverTime: Date.now() });
          break;
        case 'in':
          rooms.input(clientId, msg.s, msg.b);
          break;
        case 'team':
          rooms.switchTeam(clientId, msg.team);
          break;
        case 'role':
          rooms.setRole(clientId, msg.role);
          break;
        case 'leave':
          rooms.leave(clientId);
          break;
        case 'create': {
          const room = rooms.create(clientId, msg.name, msg.roomName, msg.public, msg.settings, sendRaw);
          send({ t: 'joined', code: room.code, playerId: clientId });
          break;
        }
        case 'join': {
          const r = rooms.join(msg.code, clientId, msg.name, sendRaw);
          if (typeof r !== 'string') send({ t: 'joined', code: r.code, playerId: clientId });
          else fail(r);
          break;
        }
        case 'settings':
          fail(rooms.setSettings(clientId, msg.settings));
          break;
        case 'start':
          fail(rooms.start(clientId));
          break;
        case 'move':
          fail(rooms.move(clientId, msg.id, msg.team));
          break;
        case 'swap':
          fail(rooms.swap(clientId, msg.a, msg.b));
          break;
        case 'stats': {
          const now = Date.now();
          if (now - lastStatsAt < 1000) break; // at most 1/s per client, whatever it sends
          lastStatsAt = now;
          clog.info({ ...rooms.whereIs(clientId), ...msg.s }, 'istemci istatistik');
          break;
        }
        case 'report':
          clog.warn({ ...rooms.whereIs(clientId), note: msg.note, recent: msg.recent }, 'oyuncu raporu (F9)');
          break;
      }
    });
  });
  return wss;
}
