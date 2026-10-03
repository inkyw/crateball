import { describe, expect, it } from 'vitest';
import { cidx } from '../src/grid';
import { createGame, ids } from '../src/state';
import { step } from '../src/step';
import { damageBuilding } from '../src/systems/combat';
import type { PlayerInput } from '../src/types';

describe('step hattı', () => {
  it('girdideki place komutu çit kurar ve flow aynı tick içinde yenilenir', () => {
    const s = createGame(1);
    const pid = ids(s.players)[0]!;
    const input: PlayerInput = {
      playerId: pid,
      move: { x: 0, z: 0 },
      aim: null,
      attack: false,
      place: { kind: 'fence', i: 33, j: 37, rot: 0 },
    };
    const { events } = step(s, [input]);
    expect(events.some((e) => e.t === 'built')).toBe(true);
    expect(s.resources.wood).toBe(5);
    expect(s.flowDirty).toBe(false);
    expect(s.flow.hearth.dist[cidx(33, 37)]).toBeGreaterThan(s.flow.hearth.dist[cidx(33, 36)]!);
  });
  it('Hearth yıkılınca gameOver olayı ve over; sonraki step boş', () => {
    const s = createGame(1);
    const events: never[] = [];
    damageBuilding(s, s.hearthId, 500, events as unknown as []);
    expect(s.over).toBe(true);
    expect(events as unknown[]).toContainEqual({ t: 'gameOver' });
    const tick = s.tick;
    expect(step(s, []).events).toEqual([]);
    expect(s.tick).toBe(tick);
  });
});
