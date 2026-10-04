import { ITEMS, type Game, type ItemKind, type Team } from '@crateball/sim';

export type GameEvent =
  | { type: 'kick'; x: number; y: number; power: boolean }
  | { type: 'shot'; x: number; y: number; vx: number; vy: number }
  | { type: 'hit'; x: number; y: number; team: Team }
  | { type: 'item'; x: number; y: number; kind: ItemKind }
  | { type: 'goal'; team: Team; x: number; y: number }
  | { type: 'whistle'; long: boolean };

/**
 * Turns successive predicted states into one-shot events (sounds, particles). Rollback re-simulation
 * replays the same ticks; tick stamps and growing ids keep each event from firing twice.
 */
export function createEventTracker() {
  let lastTick = -1;
  let lastPhase = '';
  let lastScore = '';
  let maxBullet = 0;
  const kickSeen = new Map<string, number>();
  const hp = new Map<string, number>();
  let blastsSeen = new Set<string>();

  return (g: Game | null): GameEvent[] => {
    const out: GameEvent[] = [];
    if (!g) {
      lastTick = -1;
      maxBullet = 0;
      return out;
    }
    const fresh = lastTick < 0 || g.tick < lastTick;
    lastTick = g.tick;
    const score = g.score.join(':');
    if (!fresh) {
      if (score !== lastScore && g.phase === 'goal')
        out.push({ type: 'goal', team: g.ball.x > 0 ? 'red' : 'blue', x: g.ball.x, y: g.ball.y });
      if (g.phase !== lastPhase && (g.phase === 'over' || g.phase === 'kickoff'))
        out.push({ type: 'whistle', long: g.phase === 'over' });
    } else if (g.phase === 'kickoff') out.push({ type: 'whistle', long: false });
    lastScore = score;
    lastPhase = g.phase;
    for (const p of g.players) {
      const seen = kickSeen.get(p.id) ?? -1;
      if (!fresh && p.kickTick > seen && g.tick - p.kickTick < 10)
        out.push({ type: 'kick', x: g.ball.x, y: g.ball.y, power: Math.hypot(g.ball.vx, g.ball.vy) > 8 });
      kickSeen.set(p.id, Math.max(p.kickTick, seen));
      const before = hp.get(p.id);
      if (!fresh && before !== undefined && p.hp < before && p.dead === 0)
        out.push({ type: 'hit', x: p.x, y: p.y, team: p.team });
      hp.set(p.id, p.hp);
    }
    for (const b of g.bullets) {
      if (b.id > maxBullet) {
        if (!fresh) out.push({ type: 'shot', x: b.x, y: b.y, vx: b.vx, vy: b.vy });
        maxBullet = b.id;
      }
    }
    const blasts = new Set<string>();
    for (const b of g.blasts) {
      const key = `${b.kind}:${g.tick - (ITEMS.blastShow - b.t)}`;
      blasts.add(key);
      if (!fresh && !blastsSeen.has(key)) out.push({ type: 'item', x: b.x, y: b.y, kind: b.kind });
    }
    blastsSeen = blasts;
    return out;
  };
}
