import { describe, expect, it } from 'vitest';
import { LEVEL_GROUND, LEVEL_HILL, WATER } from '../src/content/island';
import { DIRS, cellCenter, cellCoords, cidx, inGrid } from '../src/grid';
import { generateIsland } from '../src/island';
import { type MoveView, isSolidCell, moveCircle } from '../src/movement';

function view(seed = 1): MoveView {
  const island = generateIsland(seed);
  return { island, occ: new Array<number>(island.level.length).fill(0) };
}
const R = 0.35;

describe('moveCircle', () => {
  it('açık zeminde tam hareket; sıfır vektörde NaN yok', () => {
    const v = view();
    expect(moveCircle(v, 0.5, 3.5, 0.2, 0, R)).toEqual({ x: 0.7, z: 3.5 });
    const p = moveCircle(v, 0.5, 3.5, 0, 0, R);
    expect(p).toEqual({ x: 0.5, z: 3.5 });
    expect(Number.isNaN(moveCircle(v, 0.5, 3.5, -0.2, 0.2, R).x)).toBe(false);
  });
  it('suya girilmez: kıyıda durur', () => {
    const v = view();
    let x = 0.5;
    const z = 0.5;
    for (let n = 0; n < 400; n++) ({ x } = moveCircle(v, x, z, 0.2, 0, R));
    const [i, j] = [Math.floor(x + 32), Math.floor(z + 32)];
    expect(v.island.level[cidx(i, j)]).not.toBe(WATER);
    expect(v.island.level[cidx(i + 1, j)]).toBe(WATER);
  });
  it('yar geçilmez, rampa geçilir', () => {
    const v = view();
    // rampasız bir zemin→tepe kenarı bul
    let found: [number, number, number, number] | null = null;
    for (let c = 0; c < v.island.level.length && !found; c++) {
      if (v.island.level[c] !== LEVEL_HILL) continue;
      const [i, j] = cellCoords(c);
      for (const [dx, dz] of DIRS) {
        if (!inGrid(i + dx, j + dz)) continue;
        const n = cidx(i + dx, j + dz);
        if (v.island.level[n] === LEVEL_GROUND && !v.island.ramp[n]) {
          found = [i + dx, j + dz, -dx, -dz];
          break;
        }
      }
    }
    const [gi, gj, dx, dz] = found!;
    const [x, z] = cellCenter(gi, gj);
    const p = moveCircle(v, x, z, dx * 0.6, dz * 0.6, R);
    expect(p).toEqual({ x, z });
    // rampa: rampa hücresinden yönünde ilerle → tepeye çıkar
    const rc = v.island.ramp.findIndex((r) => r !== null);
    const r = v.island.ramp[rc]!;
    const [ri, rj] = cellCoords(rc);
    const [rx, rz] = cellCenter(ri, rj);
    const up = moveCircle(v, rx, rz, r.dx * 0.6, r.dz * 0.6, R);
    expect(Math.floor(up.x + 32)).toBe(ri + r.dx);
    expect(Math.floor(up.z + 32)).toBe(rj + r.dz);
  });
  it('katı hücre (çit) daireyi durdurur, çapraz harekette diğer eksen kayar', () => {
    const v = view();
    const [fi, fj] = [34, 34];
    v.occ[cidx(fi, fj)] = 5;
    expect(isSolidCell(v, cidx(fi, fj))).toBe(true);
    const [fx, fz] = cellCenter(fi, fj);
    const start = { x: fx - 1.5, z: fz };
    const p = moveCircle(v, start.x, start.z, 0.6, 0.2, R);
    expect(p.z).toBeCloseTo(fz + 0.2, 6); // z serbest
    expect(p.x).toBeLessThanOrEqual(fx - 0.5 - R + 1e-9); // x çite dayanır
    // ince adımlarla yaklaşınca çit kenarına r mesafesinde durur
    let x = start.x;
    for (let n = 0; n < 50; n++) ({ x } = moveCircle(v, x, fz, 0.05, 0, R));
    expect(x).toBeLessThanOrEqual(fx - 0.5 - R + 1e-9);
    expect(x).toBeGreaterThan(fx - 0.5 - R - 0.06);
  });
  it('dünya sınırı dışına çıkılmaz', () => {
    const v = view();
    const p = moveCircle(v, 0.5, 0.5, 100, 0, R);
    expect(p.x).toBeLessThan(32);
  });
});
