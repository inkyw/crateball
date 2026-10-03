import { describe, expect, it } from 'vitest';
import {
  LEVEL_H,
  SUB,
  type TerrainGrid,
  buildGridLines,
  buildTerrainGeometry,
  createHeightField,
  createWater,
} from '../src/terrain';

/** Sentetik ada: yarıçap 20 kara, (10,32) merkezli 3×3 tepe, (6,32) rampası +x yönünde tepeye çıkar. */
function grid(): TerrainGrid {
  const size = 64;
  const level = new Array<number>(size * size).fill(-1);
  const ramp = new Array<{ k: number; dx: number; dz: number } | null>(size * size).fill(null);
  const c = (i: number, j: number) => j * size + i;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) if (Math.hypot(i - 31.5, j - 31.5) < 20) level[c(i, j)] = 1;
  // Tepe (16..18, 31..33) ve rampası (15, 31..33) kara çemberinin (r 20) içinde kalır; (14, j) yaklaşım hücreleri de karadır.
  for (let j = 31; j <= 33; j++) for (let i = 16; i <= 18; i++) level[c(i, j)] = 2;
  for (let j = 31; j <= 33; j++) ramp[c(15, j)] = { k: 1, dx: 1, dz: 0 };
  for (let j = 31; j <= 33; j++)
    if (level[c(14, j)] !== 1 || level[c(15, j)] !== 1) throw new Error('fixture: rampa karada değil');
  const bfs = (src: (k: number) => boolean) => {
    const out = new Array<number>(size * size).fill(1e9);
    const q: number[] = [];
    for (let k = 0; k < size * size; k++)
      if (src(k)) {
        out[k] = 0;
        q.push(k);
      }
    for (let h = 0; h < q.length; h++) {
      const k = q[h]!;
      const i = k % size;
      const j = Math.floor(k / size);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ni = i + dx!;
        const nj = j + dz!;
        if (ni < 0 || nj < 0 || ni >= size || nj >= size) continue;
        if (out[c(ni, nj)]! > out[k]! + 1) {
          out[c(ni, nj)] = out[k]! + 1;
          q.push(c(ni, nj));
        }
      }
    }
    return out;
  };
  return { size, level, ramp, dWater: bfs((k) => level[k] === -1), dLand: bfs((k) => level[k] !== -1) };
}

describe('heightfield', () => {
  const g = grid();
  const hf = createHeightField(g, 7);
  it('meydan zemin yüksekliğinde, tepe üstü LEVEL_H[2], su negatif', () => {
    expect(hf.heightAt(0, 0)).toBeCloseTo(LEVEL_H[1], 1);
    expect(hf.heightAt(17 - 32 + 0.5, 32 - 32 + 0.5)).toBeCloseTo(LEVEL_H[2], 1);
    expect(hf.heightAt(28, 0)).toBeLessThan(0);
  });
  it('rampa hücresi iki kat arasında doğrusal yükselir', () => {
    const x0 = 15 - 32 + 0.05;
    const x1 = 15 - 32 + 0.95;
    const z = 32 - 32 + 0.5;
    const h0 = hf.heightAt(x0, z);
    const h1 = hf.heightAt(x1, z);
    expect(h1).toBeGreaterThan(h0 + 0.3);
    expect(h0).toBeGreaterThanOrEqual(LEVEL_H[1] - 0.1);
    expect(h1).toBeLessThanOrEqual(LEVEL_H[2] + 0.05);
    expect(hf.slopeAt(15 - 32 + 0.5, z)).toBeGreaterThan(0.3);
  });
});

describe('terrain geometry', () => {
  const g = grid();
  const hf = createHeightField(g, 7);
  it('köşe renkli, indekssiz, üçgen bütçesinde (derin su atlanır)', () => {
    const geo = buildTerrainGeometry(g, hf, 7);
    expect(geo.index).toBeNull();
    expect(geo.getAttribute('color').itemSize).toBe(3);
    const tris = geo.getAttribute('position').count / 3;
    const landCells = Array.from(g.level).filter((l) => l !== -1).length;
    expect(tris).toBeGreaterThanOrEqual(landCells * SUB * SUB * 2);
    expect(tris).toBeLessThan(90_000);
  });
  it('ızgara çizgileri yalnızca kara hücreleri için', () => {
    const lines = buildGridLines(g, hf);
    const landCells = Array.from(g.level).filter((l) => l !== -1).length;
    expect(lines.geometry.getAttribute('position').count).toBe(landCells * 8);
    expect(lines.visible).toBe(false);
  });
  it('su: uTime/uNight uniformları güncellenir', () => {
    const w = createWater(hf, 64);
    w.setTime(3.5);
    w.setNight(0.7);
    const u = w.mesh.material.uniforms;
    expect(u.uTime!.value).toBe(3.5);
    expect(u.uNight!.value).toBe(0.7);
  });
});
