import { cloneGame, step, type Game } from '@crateball/sim';

/**
 * Client-side prediction of the WHOLE world (players, ball, bullets, crates).
 *
 * Why: in a host-authoritative game the ball only moves on the client after a round trip, so a kick
 * feels late and the ball jumps. Here the client simulates every tick locally with its own input
 * immediately; other players repeat their last known input. When an authoritative snapshot arrives
 * we roll back to it, drop acknowledged inputs and re-simulate the rest. The visual difference
 * between the old and the new prediction becomes an offset that decays over a few frames, so
 * corrections glide instead of snapping.
 */

export interface Vec {
  x: number;
  y: number;
}

/** Corrections bigger than this are teleports (respawn, kickoff reset) and are not smoothed. */
const SNAP_DISTANCE = 60;
/** Offset half-life ≈ 50 ms. */
const SMOOTH_RATE = 14;
/** Never re-simulate more than this many ticks (≈ 1 s) — a hopelessly late client just snaps. */
const MAX_PENDING = 60;

export interface Predictor {
  readonly game: Game | null;
  readonly me: string | null;
  readonly pending: number;
  readonly corrections: number;
  setMe(id: string): void;
  /** Back to the lobby: no game until the next snapshot. */
  reset(): void;
  /** One local tick with this input; returns the sequence number to send. */
  tick(bits: number): number | null;
  snapshot(ack: number, g: Game): void;
  /** Interpolated + smoothed render position of a player id or 'ball'. */
  pos(id: string, alpha: number): Vec | null;
  decay(dtSec: number): void;
}

type Positions = Map<string, Vec>;

function positions(g: Game): Positions {
  const m: Positions = new Map([['ball', { x: g.ball.x, y: g.ball.y }]]);
  for (const p of g.players) if (p.dead === 0) m.set(p.id, { x: p.x, y: p.y });
  return m;
}

export function createPredictor(): Predictor {
  let game: Game | null = null;
  let me: string | null = null;
  let seq = 0;
  let pending: Array<[number, number]> = [];
  let prev: Positions = new Map();
  let cur: Positions = new Map();
  const err: Positions = new Map();
  let corrections = 0;

  const advance = (bits: number) => {
    if (!game) return;
    prev = cur;
    step(game, me ? new Map([[me, bits]]) : undefined);
    cur = positions(game);
  };

  return {
    get game() {
      return game;
    },
    get me() {
      return me;
    },
    get pending() {
      return pending.length;
    },
    get corrections() {
      return corrections;
    },
    reset() {
      game = null;
      pending = [];
      prev = new Map();
      cur = new Map();
      err.clear();
    },
    setMe(id) {
      me = id;
      pending = [];
    },
    tick(bits) {
      if (!game) return null;
      seq++;
      pending.push([seq, bits]);
      if (pending.length > MAX_PENDING) pending.shift();
      advance(bits);
      return seq;
    },
    snapshot(ack, g) {
      const before = game ? cur : null;
      pending = pending.filter(([s]) => s > ack);
      game = cloneGame(g);
      cur = positions(game);
      prev = cur;
      for (const [, bits] of pending) advance(bits);
      if (!before) return;
      for (const [id, now] of cur) {
        const old = before.get(id);
        if (!old) continue;
        const dx = old.x - now.x;
        const dy = old.y - now.y;
        const e = err.get(id) ?? { x: 0, y: 0 };
        e.x += dx;
        e.y += dy;
        if (e.x * e.x + e.y * e.y > SNAP_DISTANCE * SNAP_DISTANCE) e.x = e.y = 0;
        else if (dx * dx + dy * dy > 0.25) corrections++;
        err.set(id, e);
      }
    },
    pos(id, alpha) {
      const c = cur.get(id);
      if (!c) return null;
      const p = prev.get(id) ?? c;
      const e = err.get(id);
      return {
        x: p.x + (c.x - p.x) * alpha + (e?.x ?? 0),
        y: p.y + (c.y - p.y) * alpha + (e?.y ?? 0),
      };
    },
    decay(dt) {
      const k = Math.exp(-dt * SMOOTH_RATE);
      for (const e of err.values()) {
        e.x *= k;
        e.y *= k;
      }
    },
  };
}
