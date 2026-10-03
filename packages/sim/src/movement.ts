import { HALF, cellIndexAt, cellOf, cidx, inGrid } from './grid';
import { canStep } from './island';
import { circleOverlapsCell } from './placement';
import type { GameState, Vec2 } from './types';

export type MoveView = Pick<GameState, 'island' | 'occ'>;
export const WORLD_LIMIT = HALF - 0.5;

/** Kaynak ya da bina olan hücre: daireler içine giremez. */
export const isSolidCell = (view: MoveView, c: number): boolean => (view.occ[c] ?? 0) !== 0;

const clampWorld = (v: number): number => Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, v));

/** (x,z)→(nx,nz) tek eksen adımı geçerli mi: merkez hücre kuralı + katı hücrelerle daire çakışması. */
function passable(view: MoveView, x: number, z: number, nx: number, nz: number, r: number): boolean {
  const ca = cellIndexAt(x, z);
  const cb = cellIndexAt(nx, nz);
  if (cb < 0) return false;
  if (ca >= 0 && ca !== cb && !canStep(view.island, ca, cb)) return false;
  const [i, j] = cellOf(nx, nz);
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      if (!inGrid(i + di, j + dj)) continue;
      if (isSolidCell(view, cidx(i + di, j + dj)) && circleOverlapsCell(nx, nz, r, i + di, j + dj))
        return false;
    }
  return true;
}

/**
 * Daireyi (dx,dz) kadar taşır; önce x sonra z. Engellenen eksen iptal edilir → kenar boyunca kayma.
 * Adım bir hücreden küçük olmalı (hız 4 u/s × DT 0.05 = 0.2).
 */
export function moveCircle(view: MoveView, x: number, z: number, dx: number, dz: number, r: number): Vec2 {
  let cx = x;
  let cz = z;
  if (dx !== 0) {
    const nx = clampWorld(cx + dx);
    if (passable(view, cx, cz, nx, cz, r)) cx = nx;
  }
  if (dz !== 0) {
    const nz = clampWorld(cz + dz);
    if (passable(view, cx, cz, cx, nz, r)) cz = nz;
  }
  return { x: cx, z: cz };
}
