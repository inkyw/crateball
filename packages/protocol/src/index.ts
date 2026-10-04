import type { Game, Role, Settings, Team } from '@crateball/sim';

export const PROTOCOL_VERSION = 3;
/** 4 letters, no look-alikes (I/O). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
export const MAX_MESSAGE_BYTES = 64 * 1024;

export type ClientMessage =
  | { t: 'hello'; protocolVersion: number; sessionToken?: string }
  | { t: 'ping'; id: number }
  | { t: 'create'; name: string; roomName: string; public: boolean; settings: Settings }
  | { t: 'join'; code: string; name: string }
  | { t: 'leave' }
  | { t: 'settings'; settings: Settings }
  | { t: 'start' }
  /** Host: swap two players (team + role). */
  | { t: 'swap'; a: string; b: string }
  /** Host (anyone) or self: move a player to a team. */
  | { t: 'move'; id: string; team: Team }
  /** One input byte per client tick; `s` is the client's sequence number. */
  | { t: 'in'; s: number; b: number }
  | { t: 'team'; team: Team }
  | { t: 'role'; role: Role };

export type ErrorCode = 'version_mismatch' | 'bad_message' | 'room_full' | 'room_not_found' | 'not_host';

export interface RoomPlayer {
  id: string;
  name: string;
  team: Team;
  role: Role;
  bot: boolean;
}

export interface RoomInfo {
  code: string;
  name: string;
  public: boolean;
  host: string;
  state: 'lobby' | 'playing';
  settings: Settings;
  players: RoomPlayer[];
}

/** GET /rooms entry. */
export interface RoomListing {
  code: string;
  name: string;
  humans: number;
  max: number;
  state: 'lobby' | 'playing';
}

export type ServerMessage =
  | { t: 'welcome'; protocolVersion: number; clientId: string; serverTime: number }
  | { t: 'pong'; id: number; serverTime: number }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'joined'; code: string; playerId: string }
  | { t: 'room'; room: RoomInfo }
  /** Authoritative state at `tick`; `ack` = last input sequence of yours already applied. */
  | { t: 'snap'; tick: number; ack: number; g: Game };

type Obj = Record<string, unknown>;
const ERROR_CODES: readonly string[] = [
  'version_mismatch',
  'bad_message',
  'room_full',
  'room_not_found',
  'not_host',
];
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

/** Strips control characters and trims; null when nothing is left. */
function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = [...v]
    .filter((c) => c >= ' ')
    .join('')
    .trim()
    .slice(0, max);
  return s || null;
}

export function decodeSettings(v: unknown): Settings | null {
  if (!isObj(v)) return null;
  const { minutes, scoreLimit, crates, bots } = v;
  if (![2, 3, 5, 10].includes(minutes as number) || ![3, 5, 7, 10].includes(scoreLimit as number))
    return null;
  if (crates !== 'off' && crates !== 'normal' && crates !== 'chaos') return null;
  if (typeof bots !== 'boolean') return null;
  return { minutes: minutes as number, scoreLimit: scoreLimit as number, crates, bots };
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
    case 'create': {
      const settings = decodeSettings(m.settings);
      if (!settings || typeof m.public !== 'boolean') return null;
      const name = cleanText(m.name, 16) ?? 'Player';
      const roomName = cleanText(m.roomName, 24) ?? `${name}'s room`;
      return { t: 'create', name, roomName, public: m.public, settings };
    }
    case 'join':
      return isStr(m.code, 4) && CODE_RE.test(m.code)
        ? { t: 'join', code: m.code, name: cleanText(m.name, 16) ?? 'Player' }
        : null;
    case 'leave':
      return { t: 'leave' };
    case 'start':
      return { t: 'start' };
    case 'swap':
      return isStr(m.a, 64) && isStr(m.b, 64) && m.a !== m.b ? { t: 'swap', a: m.a, b: m.b } : null;
    case 'move':
      return isStr(m.id, 64) && (m.team === 'red' || m.team === 'blue')
        ? { t: 'move', id: m.id, team: m.team }
        : null;
    case 'settings': {
      const settings = decodeSettings(m.settings);
      return settings ? { t: 'settings', settings } : null;
    }
    case 'in':
      return isUint(m.s) && isUint(m.b) && m.b < 64 ? { t: 'in', s: m.s, b: m.b } : null;
    case 'team':
      return m.team === 'red' || m.team === 'blue' ? { t: 'team', team: m.team } : null;
    case 'role':
      return m.role === 'gk' || m.role === 'def' || m.role === 'mid' || m.role === 'fwd'
        ? { t: 'role', role: m.role }
        : null;
    default:
      return null;
  }
}

/** Server encodes the game once per tick and wraps it per client (ack differs). */
export function encodeSnap(tick: number, ack: number, gameJson: string): string {
  return `{"t":"snap","tick":${tick},"ack":${ack},"g":${gameJson}}`;
}

/** Positions/velocities rounded to 1/1000 px: smaller packets, harmless for prediction. */
export function encodeGame(g: Game): string {
  return JSON.stringify(g, (_k, v: unknown) =>
    typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v,
  );
}

const isGame = (g: unknown): g is Game =>
  isObj(g) &&
  isUint(g.tick) &&
  Array.isArray(g.players) &&
  isObj(g.ball) &&
  Array.isArray(g.crates) &&
  Array.isArray(g.bullets) &&
  Array.isArray(g.blasts) &&
  Array.isArray(g.score);

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
    case 'joined':
      return isStr(m.code, 4) && isStr(m.playerId, 64)
        ? { t: 'joined', code: m.code, playerId: m.playerId }
        : null;
    case 'room': {
      const r = m.room;
      return isObj(r) &&
        isStr(r.code, 4) &&
        isStr(r.name, 64) &&
        Array.isArray(r.players) &&
        isObj(r.settings)
        ? { t: 'room', room: r as unknown as RoomInfo }
        : null;
    }
    case 'snap':
      return isUint(m.tick) && isUint(m.ack) && isGame(m.g)
        ? { t: 'snap', tick: m.tick, ack: m.ack, g: m.g }
        : null;
    default:
      return null;
  }
}
