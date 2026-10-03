import { describe, expect, it } from 'vitest';
import { SPAWN_MIN_DIST_FROM_HEARTH } from '../src/content/waves';
import { cellOf, cidx } from '../src/grid';
import { createGame, ids } from '../src/state';
import { step } from '../src/step';
import { spawnCells, waveCounts } from '../src/systems/waves';
import { UNREACHABLE } from '../src/types';

const counts = (s: ReturnType<typeof createGame>) => {
  const c = { shadeling: 0, stumpkin: 0, glowbug: 0 };
  for (const id of ids(s.creatures)) c[s.creatures[id]!.kind]++;
  return c;
};
const skipToNight = (s: ReturnType<typeof createGame>) => {
  s.phaseEndTick = s.tick;
};

describe('dalgalar', () => {
  it('gece 1: 0/25/50. sn dalgaları 6-0-1, 4-1-1, 6-1-2 doğurur', () => {
    const s = createGame(1);
    skipToNight(s);
    const { events } = step(s, []);
    expect(s.phase).toBe('night');
    expect(counts(s)).toEqual({ shadeling: 6, stumpkin: 0, glowbug: 1 });
    expect(events.filter((e) => e.t === 'creatureSpawned')).toHaveLength(7);
    expect(s.wavesSpawned).toBe(1);
    for (const id of ids(s.creatures)) delete s.creatures[id];
    for (let k = 0; k < 500; k++) step(s, []);
    expect(counts(s)).toEqual({ shadeling: 4, stumpkin: 1, glowbug: 1 });
    for (const id of ids(s.creatures)) delete s.creatures[id];
    for (let k = 0; k < 500; k++) step(s, []);
    expect(counts(s)).toEqual({ shadeling: 6, stumpkin: 1, glowbug: 2 });
    expect(s.wavesSpawned).toBe(3);
  });
  it("doğma hücreleri kıyıda, Hearth'tan ≥14, Hearth'a yolu var; yaratıklar oraya doğar", () => {
    const s = createGame(2);
    const cells = spawnCells(s);
    expect(cells.length).toBeGreaterThan(20);
    for (const c of cells) {
      expect(s.island.dWater[c]).toBe(1);
      expect(s.flow.hearth.dist[c]).toBeLessThan(UNREACHABLE);
    }
    skipToNight(s);
    step(s, []);
    for (const id of ids(s.creatures)) {
      const c = s.creatures[id]!;
      expect(Math.hypot(c.x, c.z)).toBeGreaterThanOrEqual(SPAWN_MIN_DIST_FROM_HEARTH - 0.5);
      expect(cells).toContain(cidx(...cellOf(c.x, c.z)));
    }
  });
  it('sonraki geceler ×(1+0.35·(n−1)), yuvarlanır', () => {
    expect(waveCounts(1, { atS: 0, shadeling: 6, stumpkin: 0, glowbug: 1 })).toEqual({
      shadeling: 6,
      stumpkin: 0,
      glowbug: 1,
    });
    expect(waveCounts(2, { atS: 0, shadeling: 6, stumpkin: 1, glowbug: 1 })).toEqual({
      shadeling: 8,
      stumpkin: 1,
      glowbug: 1,
    });
    expect(waveCounts(4, { atS: 0, shadeling: 6, stumpkin: 1, glowbug: 2 })).toEqual({
      shadeling: 12,
      stumpkin: 2,
      glowbug: 4,
    });
  });
  it('gündüz dalga yok', () => {
    const s = createGame(1);
    for (let k = 0; k < 100; k++) step(s, []);
    expect(counts(s)).toEqual({ shadeling: 0, stumpkin: 0, glowbug: 0 });
  });
});
