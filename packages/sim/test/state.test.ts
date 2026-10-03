import { describe, expect, it } from 'vitest';
import { BUILDINGS, HEARTH_CELLS, PLAYER, RESOURCE_COUNTS, START_RESOURCES } from '../src/content/index';
import { cellCenter, cidx } from '../src/grid';
import { hashState } from '../src/hash';
import { createGame, ids, nextRandom, randInt } from '../src/state';

describe('createGame', () => {
  const s = createGame(1);
  it('Hearth 2×2, 500 can, merkezde; hearthId doğru', () => {
    const h = s.buildings[s.hearthId]!;
    expect(h.kind).toBe('hearth');
    expect(h.hp).toBe(BUILDINGS.hearth.hp);
    expect(h.cells).toEqual(HEARTH_CELLS.map(([i, j]) => cidx(i, j)));
    for (const c of h.cells) expect(s.occ[c]).toBe(h.id);
  });
  it('14 ağaç, 8 kaya, 7 çalı; uzaklık kuralları; occ tutarlı', () => {
    const counts = { tree: 0, rock: 0, bush: 0 };
    for (const id of ids(s.nodes)) {
      const n = s.nodes[id]!;
      counts[n.kind]++;
      const [x, z] = cellCenter(n.i, n.j);
      expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(n.kind === 'bush' ? 6.5 : 7.5);
      expect(s.occ[cidx(n.i, n.j)]).toBe(id);
    }
    expect(counts).toEqual(RESOURCE_COUNTS);
    expect(s.occ.filter((v) => v !== 0)).toHaveLength(14 + 8 + 7 + 4);
  });
  it('tek oyuncu Hearth yanında, tam can; başlangıç kaynakları; gün 1', () => {
    const [pid] = ids(s.players);
    const p = s.players[pid!]!;
    expect(p).toMatchObject({
      x: PLAYER.respawnPos.x,
      z: PLAYER.respawnPos.z,
      hp: PLAYER.maxHp,
      dead: false,
    });
    expect(s.resources).toEqual(START_RESOURCES);
    expect(s).toMatchObject({
      tick: 0,
      phase: 'day',
      day: 1,
      night: 0,
      phaseStartTick: 0,
      phaseEndTick: 1800,
      over: false,
    });
  });
  it('flow alanları hazır', () => {
    expect(s.flowDirty).toBe(false);
    for (const c of s.buildings[s.hearthId]!.cells) expect(s.flow.hearth.dist[c]).toBe(0);
  });
  it('deterministik; seed ile değişir', () => {
    expect(hashState(createGame(1))).toBe(hashState(createGame(1)));
    expect(hashState(createGame(1))).not.toBe(hashState(createGame(2)));
  });
  it('nextRandom/randInt rng durumunu ilerletir', () => {
    const a = createGame(3);
    const r0 = a.rng;
    const v = nextRandom(a);
    expect(a.rng).not.toBe(r0);
    expect(v).toBeGreaterThanOrEqual(0);
    const i = randInt(a, 2, 5);
    expect([2, 3, 4]).toContain(i);
  });
});
