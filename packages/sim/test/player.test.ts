import { describe, expect, it } from 'vitest';
import { AXE, CREATURES, PLAYER } from '../src/content/index';
import { cellIndexAt, cellOf, cidx } from '../src/grid';
import { circleOverlapsCell } from '../src/placement';
import { addBuilding, createGame, ids, spawnCreature, spawnNode } from '../src/state';
import { step } from '../src/step';
import { damagePlayer } from '../src/systems/combat';
import { updatePlayers } from '../src/systems/player';
import type { PlayerInput, SimEvent } from '../src/types';

const input = (playerId: number, o: Partial<PlayerInput> = {}): PlayerInput => ({
  playerId,
  move: { x: 0, z: 0 },
  aim: null,
  attack: false,
  place: null,
  ...o,
});
const game = () => {
  const s = createGame(1);
  const pid = ids(s.players)[0]!;
  return { s, pid, p: () => s.players[pid]! };
};
/** Yalnızca oyuncu sistemi: yaratıklar/dalgalar karışmaz (Task 14'ten sonra da geçerli kalır). */
const swing = (s: ReturnType<typeof createGame>, inp: PlayerInput, n: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let k = 0; k < n; k++) {
    s.tick++;
    updatePlayers(s, [inp], events);
  }
  return events;
};

describe('oyuncu hareketi', () => {
  it("WASD: 20 tick'te 4 birim; çaprazda normalize", () => {
    const { s, pid, p } = game();
    const x0 = p().x;
    for (let k = 0; k < 20; k++) step(s, [input(pid, { move: { x: 1, z: 0 } })]);
    expect(p().x - x0).toBeCloseTo(PLAYER.speed, 5);
    const { s: s2, pid: pid2, p: p2 } = game();
    const before = { x: p2().x, z: p2().z };
    step(s2, [input(pid2, { move: { x: 1, z: 1 } })]);
    expect(Math.hypot(p2().x - before.x, p2().z - before.z)).toBeCloseTo(PLAYER.speed * 0.05, 5);
  });
  it('nişan bakış yönünü belirler; nişan yoksa hareket yönü', () => {
    const { s, pid, p } = game();
    step(s, [input(pid, { aim: { x: p().x + 5, z: p().z } })]);
    expect(p().yaw).toBeCloseTo(Math.PI / 2, 5);
    step(s, [input(pid, { move: { x: 0, z: -1 } })]);
    expect(Math.abs(p().yaw)).toBeCloseTo(Math.PI, 5);
  });
});

describe('balta', () => {
  it('önündeki yaratığa 12 hasar, 0.5 sn bekleme; yaydaki hepsine', () => {
    const { s, pid, p } = game();
    const a = spawnCreature(s, 'stumpkin', p().x, p().z + 1.1);
    const b = spawnCreature(s, 'stumpkin', p().x + 0.6, p().z + 1.0);
    const behind = spawnCreature(s, 'stumpkin', p().x, p().z - 1.1);
    const events = swing(s, input(pid, { aim: { x: p().x, z: p().z + 10 }, attack: true }), 20);
    expect(s.creatures[a.id]!.hp).toBe(CREATURES.stumpkin.hp - 2 * AXE.creatureDamage);
    expect(s.creatures[b.id]!.hp).toBe(CREATURES.stumpkin.hp - 2 * AXE.creatureDamage);
    expect(s.creatures[behind.id]!.hp).toBe(CREATURES.stumpkin.hp);
    expect(events.filter((e) => e.t === 'hit')).toHaveLength(4);
  });
  it('yaratık yoksa en yakın ağacı keser: 4 vuruş → +3 wood, ağaç yok olur', () => {
    const { s, pid, p } = game();
    const [i, j] = cellOf(p().x + 0.5, p().z + 1.0);
    const tree = spawnNode(s, 'tree', i, j);
    const wood0 = s.resources.wood;
    const events = swing(s, input(pid, { aim: { x: p().x + 0.5, z: p().z + 10 }, attack: true }), 31);
    expect(s.nodes[tree.id]).toBeUndefined();
    expect(s.resources.wood).toBe(wood0 + 3);
    expect(events.filter((e) => e.t === 'resourceGained')).toHaveLength(1);
    expect(events.filter((e) => e.t === 'nodeRemoved')[0]).toMatchObject({ t: 'nodeRemoved', kind: 'tree' });
  });
  it('menzil dışındaki ağaca vurmaz', () => {
    const { s, pid, p } = game();
    const [i, j] = cellOf(p().x, p().z + 3);
    const tree = spawnNode(s, 'tree', i, j);
    swing(s, input(pid, { aim: { x: p().x, z: p().z + 10 }, attack: true }), 11);
    expect(s.nodes[tree.id]!.hitsLeft).toBe(4);
  });
});

describe('ölüm ve yeniden doğma', () => {
  it('doğma hücresi doluysa Hearth yakınındaki ilk boş hücreye doğar (binanın içine kilitlenmez)', () => {
    const { s, pid, p } = game();
    const [ri, rj] = cellOf(PLAYER.respawnPos.x, PLAYER.respawnPos.z);
    const fence = addBuilding(s, 'fence', ri, rj, 0);
    damagePlayer(s, pid, 100, []);
    s.tick = p().respawnAtTick;
    updatePlayers(s, [], []);
    expect(p().dead).toBe(false);
    expect(circleOverlapsCell(p().x, p().z, PLAYER.radius, ri, rj)).toBe(false);
    expect(Math.hypot(p().x - PLAYER.respawnPos.x, p().z - PLAYER.respawnPos.z)).toBeLessThan(3);
    expect(s.occ[cellIndexAt(p().x, p().z)]).toBe(0);
    expect(s.buildings[fence.id]).toBeDefined();
    // doğduğu yerden hareket edebilir
    const before = p().x;
    s.tick++;
    updatePlayers(s, [input(pid, { move: { x: 1, z: 0 } })], []);
    expect(p().x).not.toBe(before);
  });
  it('varsayılan doğma noktası iki hücre sınırındaysa komşu hücredeki bina da dairenin dışında kalır', () => {
    const { s, pid, p } = game();
    const [ni, nj] = cellOf(PLAYER.respawnPos.x - 0.5, PLAYER.respawnPos.z);
    addBuilding(s, 'fence', ni, nj, 0);
    damagePlayer(s, pid, 100, []);
    s.tick = p().respawnAtTick;
    updatePlayers(s, [], []);
    expect(p().dead).toBe(false);
    const [ci, cj] = cellOf(p().x, p().z);
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        if (s.occ[cidx(ci + di, cj + dj)] === 0) continue;
        expect(circleOverlapsCell(p().x, p().z, PLAYER.radius, ci + di, cj + dj)).toBe(false);
      }
  });
  it('can 0 → ölü; 5 sn sonra Hearth yanında tam canla doğar; god hasar almaz', () => {
    const { s, pid, p } = game();
    const events: SimEvent[] = [];
    for (let k = 0; k < 20; k++) step(s, [input(pid, { move: { x: 1, z: 0 } })]);
    damagePlayer(s, pid, 100, events);
    expect(p().dead).toBe(true);
    expect(events).toEqual([{ t: 'playerDied', playerId: pid }]);
    for (let k = 0; k < 99; k++) step(s, [input(pid, { move: { x: 1, z: 0 } })]);
    expect(p().dead).toBe(true);
    const { events: ev } = step(s, []);
    expect(p()).toMatchObject({
      dead: false,
      hp: PLAYER.maxHp,
      x: PLAYER.respawnPos.x,
      z: PLAYER.respawnPos.z,
    });
    expect(ev).toEqual([{ t: 'playerRespawned', playerId: pid }]);
    p().god = true;
    damagePlayer(s, pid, 500, events);
    expect(p().hp).toBe(PLAYER.maxHp);
  });
});
