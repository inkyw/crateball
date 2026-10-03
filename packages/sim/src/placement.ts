import { BUILDINGS } from './content/buildings';
import { HEARTH_POS, HEARTH_SAFE_RADIUS, SURF_LINE_CELLS, WATER } from './content/island';
import { CREATURES } from './content/creatures';
import { PLAYER } from './content/player';
import { cellCenter, cidx, inGrid } from './grid';
import type { BuildingKind, GameState } from './types';

/** Oyuncuya gösterilen yerleştirme sebepleri (kit ile aynı, İngilizce). */
export const ISSUE = {
  offMap: 'Off map',
  water: 'Water',
  surf: 'Beach — surf line',
  ramp: 'Ramp — keep the path clear',
  hearth: 'Hearth area',
  tree: 'Tree here — chop it first',
  rock: 'Rock here — break it first',
  bush: 'Bush here — clear it first',
  occupied: 'Occupied',
  level: 'Different level — cliff edge',
  unit: 'Blocked by a unit',
  wood: 'Not enough wood',
  stone: 'Not enough stone',
} as const;

/** Yerleştirme kurallarının ihtiyaç duyduğu durum alt kümesi (testler sade nesne verebilir). */
export type PlacementView = Pick<
  GameState,
  'island' | 'occ' | 'nodes' | 'buildings' | 'players' | 'creatures'
>;

export interface PlacementCell {
  i: number;
  j: number;
  issue: string | null;
}

export function circleOverlapsCell(x: number, z: number, r: number, i: number, j: number): boolean {
  const [cx, cz] = cellCenter(i, j);
  const nx = Math.max(cx - 0.5, Math.min(x, cx + 0.5));
  const nz = Math.max(cz - 0.5, Math.min(z, cz + 0.5));
  return (x - nx) * (x - nx) + (z - nz) * (z - nz) < r * r;
}

export function unitBlocksCell(view: PlacementView, i: number, j: number): boolean {
  for (const key in view.players) {
    const p = view.players[key]!;
    if (!p.dead && circleOverlapsCell(p.x, p.z, PLAYER.radius, i, j)) return true;
  }
  for (const key in view.creatures) {
    const c = view.creatures[key]!;
    if (circleOverlapsCell(c.x, c.z, CREATURES[c.kind].radius, i, j)) return true;
  }
  return false;
}

export function occupantIssue(view: PlacementView, c: number): string | null {
  const id = view.occ[c];
  if (!id) return null;
  const node = view.nodes[id];
  if (node) return ISSUE[node.kind];
  return ISSUE.occupied;
}

/** Hücreye bina konabilir mi; konamıyorsa neden (kit `cellIssue`). */
export function cellIssue(view: PlacementView, i: number, j: number, needLevel?: number): string | null {
  if (!inGrid(i, j)) return ISSUE.offMap;
  const c = cidx(i, j);
  const L = view.island.level[c];
  if (L === WATER) return ISSUE.water;
  if ((view.island.dWater[c] as number) < SURF_LINE_CELLS) return ISSUE.surf;
  if (view.island.ramp[c]) return ISSUE.ramp;
  const [x, z] = cellCenter(i, j);
  if (Math.hypot(x - HEARTH_POS.x, z - HEARTH_POS.z) < HEARTH_SAFE_RADIUS) return ISSUE.hearth;
  const occ = occupantIssue(view, c);
  if (occ) return occ;
  if (needLevel !== undefined && L !== needLevel) return ISSUE.level;
  if (unitBlocksCell(view, i, j)) return ISSUE.unit;
  return null;
}

/** Ayak izi hücreleri; (i,j) sol-üst. v1 binaları kare olduğundan dönüş ayak izini değiştirmez. */
export function footprintCells(kind: BuildingKind, i: number, j: number): [number, number][] {
  const s = BUILDINGS[kind].size;
  const out: [number, number][] = [];
  for (let dj = 0; dj < s; dj++) for (let di = 0; di < s; di++) out.push([i + di, j + dj]);
  return out;
}

/** Çit sürükleme: baskın eksende düz hat (kit `footprint`). */
export function fenceLineCells(a: [number, number], b: [number, number]): [number, number][] {
  const di = b[0] - a[0];
  const dj = b[1] - a[1];
  const out: [number, number][] = [];
  if (Math.abs(di) >= Math.abs(dj))
    for (let k = 0; k <= Math.abs(di); k++) out.push([a[0] + Math.sign(di) * k, a[1]]);
  else for (let k = 0; k <= Math.abs(dj); k++) out.push([a[0], a[1] + Math.sign(dj) * k]);
  return out;
}

/** Çit: her hücre kendi başına; kule/fener: tüm hücreler ilk hücrenin katında. */
export function evaluatePlacement(
  view: PlacementView,
  kind: BuildingKind,
  cells: [number, number][],
): PlacementCell[] {
  const first = cells[0];
  const lv = first && inGrid(first[0], first[1]) ? view.island.level[cidx(first[0], first[1])] : undefined;
  const needLevel = kind === 'fence' ? undefined : lv;
  return cells.map(([i, j]) => ({ i, j, issue: cellIssue(view, i, j, needLevel) }));
}

export interface FreeCellOptions {
  minR: number;
  maxR: number;
  /** Çevresindeki bu kalınlıktaki halka boş ve rampasız olmalı. */
  gap: number;
}
/** Kaynak doğması için rastgele uygun hücre (kit `randomFreeCell`); 600 denemede yoksa null. */
export function randomFreeCell(
  view: PlacementView,
  rand: () => number,
  o: FreeCellOptions,
): [number, number] | null {
  const n = view.island.size;
  for (let t = 0; t < 600; t++) {
    const i = Math.floor(rand() * n);
    const j = Math.floor(rand() * n);
    const [x, z] = cellCenter(i, j);
    const r = Math.hypot(x, z);
    if (r < o.minR || r > o.maxR || cellIssue(view, i, j)) continue;
    let ok = true;
    for (let dj = -o.gap; dj <= o.gap && ok; dj++)
      for (let di = -o.gap; di <= o.gap; di++) {
        if (!inGrid(i + di, j + dj)) continue;
        const c = cidx(i + di, j + dj);
        if (view.occ[c] || view.island.ramp[c]) {
          ok = false;
          break;
        }
      }
    if (ok) return [i, j];
  }
  return null;
}
