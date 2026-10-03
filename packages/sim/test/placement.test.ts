import { describe, expect, it } from 'vitest';
import { HEARTH_CELLS, LEVEL_GROUND, LEVEL_HILL, WATER } from '../src/content/island';
import { cellCenter, cellCoords, cellOf, cidx } from '../src/grid';
import { generateIsland } from '../src/island';
import {
  ISSUE,
  type PlacementView,
  cellIssue,
  circleOverlapsCell,
  evaluatePlacement,
  fenceLineCells,
  footprintCells,
  randomFreeCell,
} from '../src/placement';
import { createRng } from '../src/rng';

function view(seed = 1): PlacementView {
  const island = generateIsland(seed);
  return {
    island,
    occ: new Array<number>(island.level.length).fill(0),
    nodes: {},
    buildings: {},
    players: {},
    creatures: {},
  };
}
const free = (v: PlacementView, pred: (c: number) => boolean) =>
  cellCoords(v.island.level.findIndex((_, c) => pred(c)));

describe('cellIssue', () => {
  it('su, kumsal, rampa, Hearth çevresi', () => {
    const v = view();
    const [wi, wj] = free(v, (c) => v.island.level[c] === WATER);
    expect(cellIssue(v, wi, wj)).toBe(ISSUE.water);
    const [si, sj] = free(v, (c) => v.island.level[c] === LEVEL_GROUND && v.island.dWater[c] === 1);
    expect(cellIssue(v, si, sj)).toBe(ISSUE.surf);
    const [ri, rj] = free(v, (c) => v.island.ramp[c] !== null);
    expect(cellIssue(v, ri, rj)).toBe(ISSUE.ramp);
    expect(cellIssue(v, 31, 31)).toBe(ISSUE.hearth);
    expect(cellIssue(v, -1, 5)).toBe(ISSUE.offMap);
  });
  it('kaynak ve bina mesajları', () => {
    const v = view();
    const [i, j] = cellOf(0.5, 4.5);
    v.occ[cidx(i, j)] = 7;
    v.nodes[7] = { id: 7, kind: 'tree', i, j, hitsLeft: 4, bornTick: 0 };
    expect(cellIssue(v, i, j)).toBe(ISSUE.tree);
    v.nodes[7]!.kind = 'rock';
    expect(cellIssue(v, i, j)).toBe(ISSUE.rock);
    v.nodes[7]!.kind = 'bush';
    expect(cellIssue(v, i, j)).toBe(ISSUE.bush);
    delete v.nodes[7];
    v.buildings[7] = { id: 7, kind: 'fence', i, j, rot: 0, hp: 60, cells: [cidx(i, j)], nextShotTick: 0 };
    expect(cellIssue(v, i, j)).toBe(ISSUE.occupied);
  });
  it('farklı kat ve birim engeli; boş meydan hücresi serbest', () => {
    const v = view();
    const [i, j] = cellOf(0.5, 4.5);
    expect(cellIssue(v, i, j)).toBeNull();
    expect(cellIssue(v, i, j, LEVEL_HILL)).toBe(ISSUE.level);
    const [x, z] = cellCenter(i, j);
    v.players[1] = {
      id: 1,
      x,
      z,
      yaw: 0,
      hp: 100,
      dead: false,
      respawnAtTick: 0,
      axeReadyTick: 0,
      swingTick: 0,
      god: false,
    };
    expect(cellIssue(v, i, j)).toBe(ISSUE.unit);
    v.players[1]!.dead = true;
    expect(cellIssue(v, i, j)).toBeNull();
    v.creatures[2] = {
      id: 2,
      kind: 'shadeling',
      x: x + 0.6,
      z,
      yaw: 0,
      hp: 20,
      targetId: 0,
      nextAttackTick: 0,
      bornTick: 0,
    };
    expect(cellIssue(v, i, j)).toBe(ISSUE.unit);
  });
});

describe('ayak izleri', () => {
  it('footprintCells kule 2×2, fener 1×1', () => {
    expect(footprintCells('arrowTower', 10, 20)).toEqual([
      [10, 20],
      [11, 20],
      [10, 21],
      [11, 21],
    ]);
    expect(footprintCells('lantern', 10, 20)).toEqual([[10, 20]]);
    expect(footprintCells('hearth', 31, 31).map(([i, j]) => [i, j])).toEqual(
      HEARTH_CELLS.map(([i, j]) => [i, j]),
    );
  });
  it('fenceLineCells baskın eksende düz hat çeker', () => {
    expect(fenceLineCells([3, 3], [6, 4])).toEqual([
      [3, 3],
      [4, 3],
      [5, 3],
      [6, 3],
    ]);
    expect(fenceLineCells([3, 3], [3, 1])).toEqual([
      [3, 3],
      [3, 2],
      [3, 1],
    ]);
    expect(fenceLineCells([3, 3], [3, 3])).toEqual([[3, 3]]);
  });
  it('evaluatePlacement kule için ilk hücrenin katını ister, çit için istemez', () => {
    const v = view();
    const hill = v.island.level.findIndex(
      (l, c) => l === LEVEL_HILL && v.island.level[c + 1] === LEVEL_GROUND && !v.island.ramp[c + 1],
    );
    const [hi, hj] = cellCoords(hill);
    const cells: [number, number][] = [
      [hi, hj],
      [hi + 1, hj],
    ];
    const tower = evaluatePlacement(v, 'arrowTower', cells);
    expect(tower[0]!.issue).toBeNull();
    expect(tower[1]!.issue).toBe(ISSUE.level);
    const fence = evaluatePlacement(v, 'fence', cells);
    expect(fence.map((c) => c.issue)).toEqual([null, null]);
  });
});

describe('randomFreeCell / circleOverlapsCell', () => {
  it('kurallara uyan hücre döner ve deterministiktir', () => {
    const v = view();
    const a = randomFreeCell(v, createRng(5).next, { minR: 7.5, maxR: 20, gap: 1 });
    const b = randomFreeCell(view(), createRng(5).next, { minR: 7.5, maxR: 20, gap: 1 });
    expect(a).toEqual(b);
    const rand = createRng(9).next;
    for (let n = 0; n < 50; n++) {
      const cell = randomFreeCell(v, rand, { minR: 7.5, maxR: 20, gap: 1 });
      expect(cell).not.toBeNull();
      const [i, j] = cell!;
      const [x, z] = cellCenter(i, j);
      expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(7.5);
      expect(cellIssue(v, i, j)).toBeNull();
      v.occ[cidx(i, j)] = 1000 + n;
      v.nodes[1000 + n] = { id: 1000 + n, kind: 'tree', i, j, hitsLeft: 4, bornTick: 0 };
    }
  });
  it('circleOverlapsCell', () => {
    const [i, j] = cellOf(0.5, 0.5);
    expect(circleOverlapsCell(0.5, 0.5, 0.3, i, j)).toBe(true);
    expect(circleOverlapsCell(1.2, 0.5, 0.3, i, j)).toBe(true);
    expect(circleOverlapsCell(1.4, 0.5, 0.3, i, j)).toBe(false);
  });
});
