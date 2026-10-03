import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/content/buildings';
import { cellOf, cidx } from '../src/grid';
import { ISSUE } from '../src/placement';
import { createGame, ids, spawnNode } from '../src/state';
import { PLAYER_DOWN, applyPlacement } from '../src/systems/build';
import type { SimEvent } from '../src/types';

const game = (wood: number, stone: number) => {
  const s = createGame(1);
  s.resources = { wood, stone };
  const pid = ids(s.players)[0]!;
  const events: SimEvent[] = [];
  return { s, pid, events };
};
const kinds = (s: ReturnType<typeof createGame>) => ids(s.buildings).map((id) => s.buildings[id]!.kind);

describe('kule ve fener', () => {
  it('kule: 4 hücre, 12 wood + 6 stone düşer, occ ve built olayı', () => {
    const { s, pid, events } = game(12, 6);
    applyPlacement(s, pid, { kind: 'arrowTower', i: 33, j: 36, rot: 1 }, events);
    expect(s.resources).toEqual({ wood: 0, stone: 0 });
    expect(kinds(s)).toEqual(['hearth', 'arrowTower']);
    const tower = s.buildings[ids(s.buildings)[1]!]!;
    expect(tower.cells).toEqual([cidx(33, 36), cidx(34, 36), cidx(33, 37), cidx(34, 37)]);
    expect(tower.rot).toBe(1);
    expect(tower.hp).toBe(BUILDINGS.arrowTower.hp);
    for (const c of tower.cells) expect(s.occ[c]).toBe(tower.id);
    expect(events).toEqual([{ t: 'built', id: tower.id, kind: 'arrowTower', cells: tower.cells }]);
    expect(s.flowDirty).toBe(true);
  });
  it('kaynak yetersiz → reddedilir, hiçbir şey düşmez', () => {
    const { s, pid, events } = game(12, 5);
    applyPlacement(s, pid, { kind: 'arrowTower', i: 33, j: 36, rot: 0 }, events);
    expect(kinds(s)).toEqual(['hearth']);
    expect(s.resources).toEqual({ wood: 12, stone: 5 });
    expect(events).toEqual([{ t: 'buildRejected', playerId: pid, reason: ISSUE.stone }]);
  });
  it('ayak izinde ağaç → sebep ağaç; Hearth çevresi → sebep', () => {
    const { s, pid, events } = game(50, 50);
    const [i, j] = cellOf(2.5, 5.5);
    spawnNode(s, 'tree', i, j);
    applyPlacement(s, pid, { kind: 'lantern', i, j, rot: 0 }, events);
    applyPlacement(s, pid, { kind: 'lantern', i: 33, j: 32, rot: 0 }, events);
    expect(events.map((e) => (e.t === 'buildRejected' ? e.reason : e.t))).toEqual([ISSUE.tree, ISSUE.hearth]);
    expect(s.resources).toEqual({ wood: 50, stone: 50 });
  });
  it('bilinmeyen tür reddedilir', () => {
    const { s, pid, events } = game(50, 50);
    applyPlacement(s, pid, { kind: 'hearth' as 'fence', i: 33, j: 36, rot: 0 }, events);
    expect(events[0]).toMatchObject({ t: 'buildRejected' });
  });
});

describe('çit hattı', () => {
  it('5 hücre, ortada ağaç: 4 çit, 20 wood; ağaç hücresi atlanır', () => {
    const { s, pid, events } = game(25, 0);
    const [ti, tj] = [33, 37];
    spawnNode(s, 'tree', ti, tj);
    applyPlacement(
      s,
      pid,
      {
        kind: 'fence',
        i: 31,
        j: 37,
        rot: 0,
        cells: [
          [31, 37],
          [35, 37],
        ],
      },
      events,
    );
    expect(kinds(s).filter((k) => k === 'fence')).toHaveLength(4);
    expect(s.resources.wood).toBe(5);
    expect(s.occ[cidx(ti, tj)]).not.toBe(0);
    expect(s.buildings[s.occ[cidx(ti, tj)]!]).toBeUndefined();
    expect(events.filter((e) => e.t === 'built')).toHaveLength(4);
  });
  it('odun yetince durur: 12 wood → 2 çit, red yok', () => {
    const { s, pid, events } = game(12, 0);
    applyPlacement(
      s,
      pid,
      {
        kind: 'fence',
        i: 31,
        j: 37,
        rot: 0,
        cells: [
          [31, 37],
          [35, 37],
        ],
      },
      events,
    );
    expect(kinds(s).filter((k) => k === 'fence')).toHaveLength(2);
    expect(s.resources.wood).toBe(2);
    expect(events.some((e) => e.t === 'buildRejected')).toBe(false);
  });
  it('hiç konamazsa red: odun yok / tüm hücreler engelli', () => {
    const { s, pid, events } = game(3, 0);
    applyPlacement(s, pid, { kind: 'fence', i: 31, j: 37, rot: 0 }, events);
    expect(events).toEqual([{ t: 'buildRejected', playerId: pid, reason: ISSUE.wood }]);
    const g2 = game(50, 0);
    applyPlacement(
      g2.s,
      g2.pid,
      {
        kind: 'fence',
        i: 31,
        j: 31,
        rot: 0,
        cells: [
          [31, 31],
          [32, 31],
        ],
      },
      g2.events,
    );
    expect(g2.events).toEqual([{ t: 'buildRejected', playerId: g2.pid, reason: ISSUE.hearth }]);
  });
  it("hat uç noktalardan yeniden kurulur (çapraz girdi baskın eksene iner); hat yönü rot'u belirler, tek çit cmd.rot taşır", () => {
    const { s, pid, events } = game(50, 0);
    applyPlacement(
      s,
      pid,
      {
        kind: 'fence',
        i: 31,
        j: 37,
        rot: 1,
        cells: [
          [31, 37],
          [33, 38],
        ],
      },
      events,
    );
    const fences = ids(s.buildings)
      .filter((id) => s.buildings[id]!.kind === 'fence')
      .map((id) => s.buildings[id]!);
    expect(fences.map((f) => [f.i, f.j])).toEqual([
      [31, 37],
      [32, 37],
      [33, 37],
    ]);
    expect(fences.map((f) => f.rot)).toEqual([0, 0, 0]); // yatay hat → rot 0 (spec §3.1.1: hattın yönünü hat belirler)
    applyPlacement(
      s,
      pid,
      {
        kind: 'fence',
        i: 36,
        j: 36,
        rot: 0,
        cells: [
          [36, 36],
          [36, 38],
        ],
      },
      events,
    );
    expect(s.buildings[s.occ[cidx(36, 37)]!]!.rot).toBe(1); // dikey hat → rot 1
    applyPlacement(s, pid, { kind: 'fence', i: 38, j: 36, rot: 1 }, events);
    const single = s.buildings[s.occ[cidx(38, 36)]!]!;
    expect(single.rot).toBe(1);
  });
  it('ölü ya da olmayan oyuncu inşa yapamaz: kaynak düşmez, built yok', () => {
    const { s, pid, events } = game(50, 50);
    s.players[pid]!.dead = true;
    applyPlacement(s, pid, { kind: 'lantern', i: 36, j: 36, rot: 0 }, events);
    applyPlacement(s, 999, { kind: 'fence', i: 36, j: 37, rot: 0 }, events);
    expect(events).toEqual([
      { t: 'buildRejected', playerId: pid, reason: PLAYER_DOWN },
      { t: 'buildRejected', playerId: 999, reason: PLAYER_DOWN },
    ]);
    expect(s.resources).toEqual({ wood: 50, stone: 50 });
    expect(kinds(s)).toEqual(['hearth']);
  });
});
