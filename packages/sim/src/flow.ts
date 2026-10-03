import { BLOCKED_CELL_COST } from './content/buildings';
import { DIRS, cellCoords, cidx, inGrid } from './grid';
import { canStep } from './island';
import { type CellIndex, type FlowField, type GameState, UNREACHABLE } from './types';

export type FlowView = Pick<GameState, 'island' | 'occ' | 'nodes' | 'buildings' | 'hearthId'>;

/** Küçük ikili yığın (dist, cell). */
class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.k.length;
  }
  push(key: number, val: number): void {
    this.k.push(key);
    this.v.push(val);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((this.k[p] as number) <= (this.k[i] as number)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.k[0] as number, this.v[0] as number];
    const lk = this.k.pop() as number;
    const lv = this.v.pop() as number;
    if (this.k.length > 0) {
      this.k[0] = lk;
      this.v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.k.length && (this.k[l] as number) < (this.k[m] as number)) m = l;
        if (r < this.k.length && (this.k[r] as number) < (this.k[m] as number)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    const tk = this.k[a] as number;
    this.k[a] = this.k[b] as number;
    this.k[b] = tk;
    const tv = this.v[a] as number;
    this.v[a] = this.v[b] as number;
    this.v[b] = tv;
  }
}

export const isNodeCell = (view: FlowView, c: CellIndex): boolean => {
  const id = view.occ[c];
  return !!id && view.nodes[id] !== undefined;
};
export const isBuildingCell = (view: FlowView, c: CellIndex): boolean => {
  const id = view.occ[c];
  return !!id && view.buildings[id] !== undefined;
};

/**
 * Dijkstra, hedeflerden dışa. `c` hücresine girme maliyeti: hedef 1, bina BLOCKED_CELL_COST, kaynak hücresi geçilmez.
 * `next[b]` = b'den hedefe doğru ilk hücre.
 */
export function computeFlowField(view: FlowView, goals: CellIndex[]): FlowField {
  const n = view.island.level.length;
  const dist = new Array<number>(n).fill(UNREACHABLE);
  const next = new Array<number>(n).fill(-1);
  const goalSet = new Set(goals);
  const heap = new MinHeap();
  for (const g of goals) {
    dist[g] = 0;
    heap.push(0, g);
  }
  while (heap.size > 0) {
    const [d, c] = heap.pop();
    if (d > (dist[c] as number)) continue;
    const enter = goalSet.has(c) ? 1 : isBuildingCell(view, c) ? BLOCKED_CELL_COST : 1;
    const [i, j] = cellCoords(c);
    for (const [dx, dz] of DIRS) {
      if (!inGrid(i + dx, j + dz)) continue;
      const b = cidx(i + dx, j + dz);
      if (isNodeCell(view, b) || !canStep(view.island, b, c)) continue;
      const nd = d + enter;
      if (nd < (dist[b] as number)) {
        dist[b] = nd;
        next[b] = c;
        heap.push(nd, b);
      }
    }
  }
  return { dist, next };
}

/** Üç hedef kümesi: Hearth; tüm binalar (Hearth dahil); fenerler (yoksa Hearth). */
export function flowGoals(view: FlowView): {
  hearth: CellIndex[];
  buildings: CellIndex[];
  lanterns: CellIndex[];
} {
  const hearth = view.buildings[view.hearthId]?.cells ?? [];
  const buildings: CellIndex[] = [];
  const lanterns: CellIndex[] = [];
  for (const key of Object.keys(view.buildings)
    .map(Number)
    .sort((a, b) => a - b)) {
    const b = view.buildings[key]!;
    buildings.push(...b.cells);
    if (b.kind === 'lantern') lanterns.push(...b.cells);
  }
  return { hearth, buildings, lanterns: lanterns.length ? lanterns : hearth };
}

export function refreshFlow(state: GameState): void {
  const g = flowGoals(state);
  state.flow = {
    hearth: computeFlowField(state, g.hearth),
    buildings: computeFlowField(state, g.buildings),
    lanterns: computeFlowField(state, g.lanterns),
  };
  state.flowDirty = false;
}
