export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 64 * 1024;

export type ClientMessage =
  { t: 'hello'; protocolVersion: number; sessionToken?: string } | { t: 'ping'; id: number };

export type ErrorCode = 'version_mismatch' | 'bad_message';

export type ServerMessage =
  | { t: 'welcome'; protocolVersion: number; clientId: string; serverTime: number }
  | { t: 'pong'; id: number; serverTime: number }
  | { t: 'error'; code: ErrorCode; message: string };

type Obj = Record<string, unknown>;
const ERROR_CODES: readonly string[] = ['version_mismatch', 'bad_message'];
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isUint = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

function parse(raw: string): Obj | null {
  try {
    const v: unknown = JSON.parse(raw);
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
}

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

/** Güvenilmeyen girdi: doğrular ve yalnızca bilinen alanlarla yeni nesne döner. */
export function decodeClientMessage(raw: string): ClientMessage | null {
  const m = parse(raw);
  if (!m) return null;
  switch (m.t) {
    case 'hello': {
      if (!isUint(m.protocolVersion)) return null;
      if (m.sessionToken === undefined) return { t: 'hello', protocolVersion: m.protocolVersion };
      return isStr(m.sessionToken, 128)
        ? { t: 'hello', protocolVersion: m.protocolVersion, sessionToken: m.sessionToken }
        : null;
    }
    case 'ping':
      return isUint(m.id) ? { t: 'ping', id: m.id } : null;
    default:
      return null;
  }
}

export function decodeServerMessage(raw: string): ServerMessage | null {
  const m = parse(raw);
  if (!m) return null;
  switch (m.t) {
    case 'welcome':
      return isUint(m.protocolVersion) && isStr(m.clientId, 64) && typeof m.serverTime === 'number'
        ? { t: 'welcome', protocolVersion: m.protocolVersion, clientId: m.clientId, serverTime: m.serverTime }
        : null;
    case 'pong':
      return isUint(m.id) && typeof m.serverTime === 'number'
        ? { t: 'pong', id: m.id, serverTime: m.serverTime }
        : null;
    case 'error':
      return typeof m.code === 'string' && ERROR_CODES.includes(m.code) && isStr(m.message, 500)
        ? { t: 'error', code: m.code as ErrorCode, message: m.message }
        : null;
    default:
      return null;
  }
}
