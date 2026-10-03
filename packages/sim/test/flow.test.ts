import { describe, expect, it } from 'vitest';
import { BLOCKED_CELL_COST } from '../src/content/buildings';
import { HEARTH_CELLS, LEVEL_HILL } from '../src/content/island';
import { type FlowView, computeFlowField, flowGoals, refreshFlow } from '../src/flow';
import { cellCoords, cidx } from '../src/grid';
import { coastCells, generateIsland } from '../src/island';
import { type GameState, UNREACHABLE } from '../src/types';

function view(seed = 1): FlowView {
  const island = generateIsland(seed);
  const occ = new Array<number>(island.level.length).fill(0);
  const cells = HEARTH_CELLS.map(([i, j]) => cidx(i, j));
  for (const c of cells) occ[c] = 1;
  return {
    island,
    occ,
    nodes: {},
    buildings: { 1: { id: 1, kind: 'hearth', i: 31, j: 31, rot: 0, hp: 500, cells, nextShotTick: 0 } },
    hearthId: 1,
  };
}
function addFence(v: FlowView, id: number, i: number, j: number) {
  v.occ[cidx(i, j)] = id;
  v.buildings[id] = { id, kind: 'fence', i, j, rot: 0, hp: 60, cells: [cidx(i, j)], nextShotTick: 0 };
}
function follow(f: ReturnType<typeof computeFlowField>, c: number, max = 200): number[] {
  const path = [c];
  while (f.next[c]! >= 0 && path.length < max) {
    c = f.next[c]!;
    path.push(c);
  }
  return path;
}

describe('computeFlowField', () => {
  it('hedef hücreler 0, kıyı hücreleri ulaşılabilir, next zinciri hedefe varır', () => {
    const v = view();
    const f = computeFlowField(v, flowGoals(v).hearth);
    for (const [i, j] of HEARTH_CELLS) expect(f.dist[cidx(i, j)]).toBe(0);
    const coast = coastCells(v.island).filter((c) => f.dist[c]! < UNREACHABLE);
    expect(coast.length).toBeGreaterThan(50);
    const path = follow(f, coast[0]!);
    expect(path.length).toBe(f.dist[coast[0]!]! + 1);
    expect(v.buildings[1]!.cells).toContain(path[path.length - 1]);
  });
  it('ağaç hücresi geçilmez; yol onun etrafından dolaşır', () => {
    const v = view();
    const [i, j] = [32, 36];
    v.occ[cidx(i, j)] = 9;
    v.nodes[9] = { id: 9, kind: 'tree', i, j, hitsLeft: 4, bornTick: 0 };
    const f = computeFlowField(v, flowGoals(v).hearth);
    expect(f.dist[cidx(i, j)]).toBe(UNREACHABLE);
    expect(f.next[cidx(i, j)]).toBe(-1);
    expect(f.dist[cidx(32, 37)]).toBe(6); // 5 düz adım yerine bir yana sapar
  });
  it('çit halkası: Hearth yine ulaşılabilir, çit hücresi 8 maliyetli ve dışarıdan next çite bakar', () => {
    const v = view();
    let id = 10;
    for (let d = -3; d <= 3; d++) {
      addFence(v, id++, 31 + d, 28);
      addFence(v, id++, 31 + d, 35);
      addFence(v, id++, 28, 31 + d);
      addFence(v, id++, 35, 31 + d);
    }
    const f = computeFlowField(v, flowGoals(v).hearth);
    const outside = cidx(32, 36);
    const fence = cidx(32, 35);
    const inside = cidx(32, 34);
    expect(f.dist[inside]).toBe(2);
    // Çit hücresinde durmak = çiti yıkmış olmak: içeriden 1 adım. Dışarıdan çite girmek 8'e mal olur.
    expect(f.dist[fence]).toBe(3);
    expect(f.dist[outside]).toBe(3 + BLOCKED_CELL_COST);
    expect(f.next[outside]).toBe(fence);
    expect(v.buildings[v.occ[f.next[outside]!]!]!.kind).toBe('fence');
  });
  it('tepe hücresine yol rampadan geçer', () => {
    const v = view();
    const f = computeFlowField(v, flowGoals(v).hearth);
    const hill = v.island.level.findIndex((l) => l === LEVEL_HILL);
    expect(f.dist[hill]).toBeLessThan(UNREACHABLE);
    const path = follow(f, hill);
    expect(path.some((c) => v.island.ramp[c] !== null)).toBe(true);
    expect(path.filter((c) => v.island.level[c] === LEVEL_HILL).length).toBeLessThan(path.length);
  });
  it("flowGoals: fener yoksa lantern alanı Hearth'ı hedefler; fener varsa feneri", () => {
    const v = view();
    expect(flowGoals(v).lanterns).toEqual(flowGoals(v).hearth);
    v.occ[cidx(36, 36)] = 50;
    v.buildings[50] = {
      id: 50,
      kind: 'lantern',
      i: 36,
      j: 36,
      rot: 0,
      hp: 40,
      cells: [cidx(36, 36)],
      nextShotTick: 0,
    };
    expect(flowGoals(v).lanterns).toEqual([cidx(36, 36)]);
    expect(flowGoals(v).buildings).toHaveLength(5);
  });
  it('refreshFlow üç alanı doldurur ve bayrağı temizler; 3 alan < 60 ms', () => {
    const v = view();
    const state = {
      ...v,
      flow: {
        hearth: { dist: [], next: [] },
        buildings: { dist: [], next: [] },
        lanterns: { dist: [], next: [] },
      },
      flowDirty: true,
    } as unknown as GameState;
    const t0 = Date.now();
    refreshFlow(state);
    expect(Date.now() - t0).toBeLessThan(60);
    expect(state.flowDirty).toBe(false);
    expect(state.flow.hearth.dist).toHaveLength(64 * 64);
    expect(state.flow.buildings.dist[cidx(31, 31)]).toBe(0);
    const [ci, cj] = cellCoords(coastCells(v.island)[0]!);
    expect(state.flow.lanterns.dist[cidx(ci, cj)]).toBeLessThan(UNREACHABLE);
  });
});
