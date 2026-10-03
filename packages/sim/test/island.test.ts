import { describe, expect, it } from 'vitest';
import {
  HEARTH_CELLS,
  HILL_COUNT_MAX,
  HILL_COUNT_MIN,
  LEVEL_GROUND,
  LEVEL_HILL,
  MIN_HILL_CELLS,
  PLAZA_RADIUS,
  WATER,
} from '../src/content/island';
import { DIRS, cellCenter, cellCoords, cidx, inGrid } from '../src/grid';
import { hashState } from '../src/hash';
import { canStep, coastCells, generateIsland, landCells } from '../src/island';
import type { IslandGrid } from '../src/types';

function hillComponents(g: IslandGrid): number[][] {
  const seen = new Set<number>();
  const comps: number[][] = [];
  for (let s = 0; s < g.level.length; s++) {
    if (seen.has(s) || g.level[s] !== LEVEL_HILL) continue;
    const q = [s];
    seen.add(s);
    for (let h = 0; h < q.length; h++) {
      const [i, j] = cellCoords(q[h] as number);
      for (const [dx, dz] of DIRS) {
        if (!inGrid(i + dx, j + dz)) continue;
        const n = cidx(i + dx, j + dz);
        if (!seen.has(n) && g.level[n] === LEVEL_HILL) {
          seen.add(n);
          q.push(n);
        }
      }
    }
    comps.push(q);
  }
  return comps;
}

describe('generateIsland', () => {
  it('deterministiktir ve seed ile değişir', () => {
    expect(hashState(generateIsland(7))).toBe(hashState(generateIsland(7)));
    expect(hashState(generateIsland(7))).not.toBe(hashState(generateIsland(8)));
  });
  it('meydan ve Hearth hücreleri daima zemin katıdır', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = generateIsland(seed);
      for (let c = 0; c < g.level.length; c++) {
        const [i, j] = cellCoords(c);
        const [x, z] = cellCenter(i, j);
        if (Math.hypot(x, z) < PLAZA_RADIUS) expect(g.level[c]).toBe(LEVEL_GROUND);
      }
      for (const [i, j] of HEARTH_CELLS) expect(g.level[cidx(i, j)]).toBe(LEVEL_GROUND);
    }
  });
  it("ada büyük ölçüde düzdür: kara 900–2400 hücre, tepe hücreleri karanın %10'undan az", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = generateIsland(seed);
      const land = landCells(g).length;
      const hills = g.level.filter((l) => l === LEVEL_HILL).length;
      // Island generator is identical to the user-approved asset kit (~1000–1200 land cells); the plan's 1200 estimate was revised (controller ruling).
      expect(land).toBeGreaterThan(900);
      expect(land).toBeLessThan(2400);
      expect(hills).toBeLessThan(land * 0.1);
    }
  });
  it('4–5 ayrık tepe; her tepenin tam bir 3 hücrelik rampası vardır', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const g = generateIsland(seed);
      const comps = hillComponents(g);
      expect(comps.length).toBeGreaterThanOrEqual(HILL_COUNT_MIN);
      expect(comps.length).toBeLessThanOrEqual(HILL_COUNT_MAX);
      for (const comp of comps) {
        expect(comp.length).toBeGreaterThanOrEqual(MIN_HILL_CELLS);
        const set = new Set(comp);
        // Rampa hücresi: zemin katında, yönünde bir adım ötesi bu tepede.
        const ramps = g.ramp
          .map((r, c) => (r ? c : -1))
          .filter((c) => c >= 0)
          .filter((c) => {
            const r = g.ramp[c]!;
            const [i, j] = cellCoords(c);
            return inGrid(i + r.dx, j + r.dz) && set.has(cidx(i + r.dx, j + r.dz));
          });
        expect(ramps).toHaveLength(3);
        for (const c of ramps) expect(g.level[c]).toBe(LEVEL_GROUND);
      }
    }
  });
  it('tepeler meydana 1 hücreden yakın olamaz, dWater/dLand tutarlıdır', () => {
    const g = generateIsland(3);
    for (let c = 0; c < g.level.length; c++) {
      const [i, j] = cellCoords(c);
      const [x, z] = cellCenter(i, j);
      if (g.level[c] === LEVEL_HILL) expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(PLAZA_RADIUS + 1);
      if (g.level[c] === WATER) {
        expect(g.dWater[c]).toBe(0);
        expect(g.dLand[c]).toBeGreaterThan(0);
      } else {
        expect(g.dLand[c]).toBe(0);
        expect(g.dWater[c]).toBeGreaterThan(0);
      }
    }
  });
  it("kıyı hücreleri: su komşulu kara; Hearth'tan ≥14 uzakta en az 20 tane", () => {
    for (const seed of [1, 2, 3]) {
      const g = generateIsland(seed);
      const coast = coastCells(g);
      expect(coast.length).toBeGreaterThan(50);
      for (const c of coast) expect(g.dWater[c]).toBe(1);
      const far = coast.filter((c) => {
        const [i, j] = cellCoords(c);
        const [x, z] = cellCenter(i, j);
        return Math.hypot(x, z) >= 14;
      });
      expect(far.length).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('canStep', () => {
  const g = generateIsland(1);
  const rampCell = g.ramp.findIndex((r) => r !== null);
  const r = g.ramp[rampCell]!;
  const [ri, rj] = cellCoords(rampCell);
  it('zemin→zemin serbest, su kapalı', () => {
    const a = cidx(32, 34);
    expect(canStep(g, a, cidx(32, 35))).toBe(true);
    const water = g.level.findIndex(
      (l, c) =>
        l === WATER &&
        DIRS.some(([dx, dz]) => {
          const [i, j] = cellCoords(c);
          return inGrid(i + dx, j + dz) && g.level[cidx(i + dx, j + dz)] !== WATER;
        }),
    );
    expect(water).toBeGreaterThanOrEqual(0);
    const [wi, wj] = cellCoords(water);
    const landNeighbor = DIRS.map(([dx, dz]) => [wi + dx, wj + dz] as const).find(
      ([i, j]) => inGrid(i, j) && g.level[cidx(i, j)] !== WATER,
    );
    expect(landNeighbor).toBeDefined();
    expect(canStep(g, cidx(landNeighbor![0], landNeighbor![1]), water)).toBe(false);
    expect(canStep(g, water, cidx(landNeighbor![0], landNeighbor![1]))).toBe(false);
  });
  it('rampa yönünde tepeye çıkılır, geriye zemine inilir, yanlara çıkılmaz', () => {
    const up = cidx(ri + r.dx, rj + r.dz);
    const back = cidx(ri - r.dx, rj - r.dz);
    expect(g.level[up]).toBe(LEVEL_HILL);
    expect(canStep(g, rampCell, up)).toBe(true);
    expect(canStep(g, up, rampCell)).toBe(true);
    expect(canStep(g, back, rampCell)).toBe(true);
    // Yan hücre rampa olmayan, kara bir ramp hücresi ara (sabit tarama sırası).
    const sideRamp = g.ramp.findIndex((rr, c) => {
      if (!rr) return false;
      const [i, j] = cellCoords(c);
      const si = i + rr.dz;
      const sj = j + rr.dx;
      return inGrid(si, sj) && !g.ramp[cidx(si, sj)] && g.level[cidx(si, sj)] !== WATER;
    });
    expect(sideRamp).toBeGreaterThanOrEqual(0);
    const sr = g.ramp[sideRamp]!;
    const [si0, sj0] = cellCoords(sideRamp);
    expect(canStep(g, sideRamp, cidx(si0 + sr.dz, sj0 + sr.dx))).toBe(false);
  });
  it('yar: rampasız zemin→tepe geçilmez', () => {
    let checked = 0;
    for (let c = 0; c < g.level.length && checked < 10; c++) {
      if (g.level[c] !== LEVEL_HILL) continue;
      const [i, j] = cellCoords(c);
      for (const [dx, dz] of DIRS) {
        if (!inGrid(i + dx, j + dz)) continue;
        const n = cidx(i + dx, j + dz);
        if (g.level[n] === LEVEL_GROUND && !g.ramp[n]) {
          expect(canStep(g, n, c)).toBe(false);
          expect(canStep(g, c, n)).toBe(false);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('komşu olmayan hücreler arası adım yok', () => {
    expect(canStep(g, cidx(32, 34), cidx(32, 36))).toBe(false);
  });
});
