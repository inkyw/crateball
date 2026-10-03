import {
  GRID_SIZE,
  HILL_CELL_MIN_WATER_DIST,
  HILL_CENTER_MAX_R,
  HILL_CENTER_MIN_R,
  HILL_COUNT_MAX,
  HILL_GAP_CELLS,
  HILL_MIN_WATER_DIST,
  HILL_RADIUS_MIN,
  HILL_RADIUS_RANGE,
  HILL_TRIES,
  ISLAND_RADIUS,
  LEVEL_GROUND,
  LEVEL_HILL,
  MIN_HILL_CELLS,
  PLAZA_RADIUS,
  RAMP_WIDTH,
  WATER,
} from './content/island';
import { DIRS, cellCenter, cellCoords, cidx, inGrid } from './grid';
import { fbm, smoothstep, vnoise } from './noise';
import { createRng } from './rng';
import type { IslandGrid, Ramp } from './types';

const N = GRID_SIZE;
const NN = N * N;
const HILL_SEED_SALT = 99;
const RAMP_SEED_SALT = 777;

function rawHeight(x: number, z: number, seed: number): number {
  const r = Math.sqrt(x * x + z * z); // Math.hypot yerine: IEEE-kesin sqrt, motorlar arası aynı
  const n = fbm(x * 0.11 + 3.1, z * 0.11 - 1.7, seed, 4);
  const edge = r / ISLAND_RADIUS + (n - 0.5) * 0.6;
  return (1 - smoothstep(0.5, 1.0, edge)) * (0.9 + fbm(x * 0.07 + 10, z * 0.07, seed + 7, 3) * 2.4) - 0.45;
}

function bfsDistance(isSource: (c: number) => boolean): number[] {
  const out = new Array<number>(NN).fill(1e9);
  const q: number[] = [];
  for (let c = 0; c < NN; c++)
    if (isSource(c)) {
      out[c] = 0;
      q.push(c);
    }
  for (let h = 0; h < q.length; h++) {
    const c = q[h] as number;
    const [i, j] = cellCoords(c);
    for (const [dx, dz] of DIRS) {
      if (!inGrid(i + dx, j + dz)) continue;
      const n = cidx(i + dx, j + dz);
      if ((out[n] as number) > (out[c] as number) + 1) {
        out[n] = (out[c] as number) + 1;
        q.push(n);
      }
    }
  }
  return out;
}

/** Aynı kattaki bitişik hücre kümeleri (4 komşuluk). */
function components(level: number[], target: number): number[][] {
  const seen = new Uint8Array(NN);
  const comps: number[][] = [];
  for (let s = 0; s < NN; s++) {
    if (seen[s] || level[s] !== target) continue;
    const q = [s];
    seen[s] = 1;
    for (let h = 0; h < q.length; h++) {
      const [i, j] = cellCoords(q[h] as number);
      for (const [dx, dz] of DIRS) {
        if (!inGrid(i + dx, j + dz)) continue;
        const n = cidx(i + dx, j + dz);
        if (!seen[n] && level[n] === target) {
          seen[n] = 1;
          q.push(n);
        }
      }
    }
    comps.push(q);
  }
  return comps;
}

interface RampRun {
  cells: [number, number][];
  dx: number;
  dz: number;
  x: number;
  z: number;
}

/** Tepeye (comp) bitişik, zeminde, 3 hücre genişliğinde aday rampa dizileri. */
function rampRuns(level: number[], ramp: (Ramp | null)[], comp: number[]): RampRun[] {
  const inComp = new Set(comp);
  const k = LEVEL_GROUND;
  const ok = (i: number, j: number, dx: number, dz: number): boolean => {
    if (!inGrid(i, j) || !inGrid(i - dx, j - dz) || !inGrid(i + dx, j + dz)) return false;
    const c = cidx(i, j);
    return (
      level[c] === k && !ramp[c] && level[cidx(i - dx, j - dz)] === k && inComp.has(cidx(i + dx, j + dz))
    );
  };
  const seen = new Set<string>();
  const runs: RampRun[] = [];
  for (const c of comp) {
    const [ni, nj] = cellCoords(c);
    for (const [dx, dz] of DIRS) {
      const i = ni - dx;
      const j = nj - dz;
      const px = dz;
      const pz = dx;
      let fits = true;
      for (let w = 0; w < RAMP_WIDTH; w++) if (!ok(i + px * w, j + pz * w, dx, dz)) fits = false;
      if (!fits) continue;
      const key = `${cidx(i, j)}:${dx},${dz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cells: [number, number][] = [];
      for (let w = 0; w < RAMP_WIDTH; w++) cells.push([i + px * w, j + pz * w]);
      const [x, z] = cellCenter(i + px, j + pz);
      runs.push({ cells, dx, dz, x, z });
    }
  }
  return runs;
}

/** Kit `buildLevels` portu. Her tepe tam bir rampa alır; rampa bulunamayan ya da küçük tepe düzleştirilir. */
export function generateIsland(seed: number): IslandGrid {
  const level = new Array<number>(NN).fill(WATER);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const [x, z] = cellCenter(i, j);
      level[cidx(i, j)] =
        x * x + z * z < PLAZA_RADIUS * PLAZA_RADIUS || rawHeight(x, z, seed) >= 0.02 ? LEVEL_GROUND : WATER;
    }
  // Çoğunluk filtresi: bölgeler benekli değil, topaklı olsun.
  for (let pass = 0; pass < 2; pass++) {
    const src = level.slice();
    for (let j = 1; j < N - 1; j++)
      for (let i = 1; i < N - 1; i++) {
        const [x, z] = cellCenter(i, j);
        if (x * x + z * z < PLAZA_RADIUS * PLAZA_RADIUS) continue;
        const cnt = [0, 0, 0, 0];
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) cnt[(src[cidx(i + di, j + dj)] as number) + 1]!++;
        const best = cnt.indexOf(Math.max(...cnt));
        if ((cnt[best] as number) >= 5) level[cidx(i, j)] = best - 1;
      }
  }
  const dWater = bfsDistance((c) => level[c] === WATER);
  const dLand = bfsDistance((c) => level[c] !== WATER);

  // Tepeler: ayrık, her biri yerleştirilir yerleştirilmez rampası doğrulanır; HILL_COUNT_MAX'a kadar.
  // Determinizm: aday hücreler tamsayı RNG ile, mesafeler kareli; rampa seçimi tamsayı indeksle.
  const ramp = new Array<Ramp | null>(NN).fill(null);
  const H = createRng((seed ^ HILL_SEED_SALT) >>> 0);
  const R = createRng((seed ^ RAMP_SEED_SALT) >>> 0);
  const minR2 = HILL_CENTER_MIN_R * HILL_CENTER_MIN_R;
  const maxR2 = HILL_CENTER_MAX_R * HILL_CENTER_MAX_R;
  const plazaGuard2 = (PLAZA_RADIUS + 1) * (PLAZA_RADIUS + 1);
  const nearHill = (ci: number, cj: number): boolean => {
    for (let dj = -HILL_GAP_CELLS; dj <= HILL_GAP_CELLS; dj++)
      for (let di = -HILL_GAP_CELLS; di <= HILL_GAP_CELLS; di++)
        if (inGrid(ci + di, cj + dj) && level[cidx(ci + di, cj + dj)] === LEVEL_HILL) return true;
    return false;
  };
  for (let hills = 0, tries = 0; hills < HILL_COUNT_MAX && tries < HILL_TRIES; tries++) {
    const ci = H.int(0, N);
    const cj = H.int(0, N);
    const rad = HILL_RADIUS_MIN + H.next() * HILL_RADIUS_RANGE;
    const [cx, cz] = cellCenter(ci, cj);
    const d2 = cx * cx + cz * cz;
    const cc = cidx(ci, cj);
    if (
      d2 < minR2 ||
      d2 > maxR2 ||
      level[cc] !== LEVEL_GROUND ||
      (dWater[cc] as number) < HILL_MIN_WATER_DIST ||
      nearHill(ci, cj)
    )
      continue;
    const placed: number[] = [];
    for (let dj = -4; dj <= 4; dj++)
      for (let di = -4; di <= 4; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (!inGrid(i, j)) continue;
        const c = cidx(i, j);
        const [x, z] = cellCenter(i, j);
        if (
          level[c] !== LEVEL_GROUND ||
          (dWater[c] as number) < HILL_CELL_MIN_WATER_DIST ||
          x * x + z * z < plazaGuard2
        )
          continue;
        if (Math.sqrt(di * di + dj * dj) + (vnoise(x * 0.9, z * 0.9, 61) - 0.5) * 1.2 <= rad) {
          level[c] = LEVEL_HILL;
          placed.push(c);
        }
      }
    // Gürültü blobu parçalayabilir: en büyük bağlı parça kalır, diğerleri geri alınır.
    const parts = components(level, LEVEL_HILL).filter((comp) => comp.some((c) => placed.includes(c)));
    parts.sort((a, b) => b.length - a.length || (a[0] as number) - (b[0] as number));
    const comp = parts[0] ?? [];
    for (const c of placed) if (!comp.includes(c)) level[c] = LEVEL_GROUND;
    const runs = comp.length >= MIN_HILL_CELLS ? rampRuns(level, ramp, comp) : [];
    if (runs.length === 0) {
      for (const c of comp) level[c] = LEVEL_GROUND;
      continue;
    }
    const best = runs[R.int(0, runs.length)] as RampRun;
    for (const [i, j] of best.cells) ramp[cidx(i, j)] = { k: LEVEL_GROUND, dx: best.dx, dz: best.dz };
    hills++;
  }
  return { size: N, level, ramp, dWater, dLand };
}

/** Komşu hücreler arası adım: aynı kat, ya da rampa yönünde çık/in. Su ve yarlar kapalı. */
export function canStep(grid: IslandGrid, a: number, b: number): boolean {
  const la = grid.level[a];
  const lb = grid.level[b];
  if (la === undefined || lb === undefined || la === WATER || lb === WATER) return false;
  const [ai, aj] = cellCoords(a);
  const [bi, bj] = cellCoords(b);
  const dx = bi - ai;
  const dz = bj - aj;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return false;
  const ra = grid.ramp[a] ?? null;
  const rb = grid.ramp[b] ?? null;
  if (!ra && !rb) return la === lb;
  if (ra && rb) return ra.k === rb.k && ra.dx === rb.dx && ra.dz === rb.dz && dx * ra.dx + dz * ra.dz === 0;
  const r = (ra ?? rb) as Ramp;
  const ddx = ra ? dx : -dx;
  const ddz = ra ? dz : -dz;
  const other = ra ? lb : la;
  if (ddx === r.dx && ddz === r.dz) return other === r.k + 1;
  if (ddx === -r.dx && ddz === -r.dz) return other === r.k;
  return false;
}

export function landCells(grid: IslandGrid): number[] {
  const out: number[] = [];
  for (let c = 0; c < grid.level.length; c++) if (grid.level[c] !== WATER) out.push(c);
  return out;
}
/** Su komşulu kara hücreleri (yaratık doğma adayları). */
export function coastCells(grid: IslandGrid): number[] {
  return landCells(grid).filter((c) => grid.dWater[c] === 1);
}
