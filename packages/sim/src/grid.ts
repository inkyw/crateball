import { GRID_SIZE } from './content/island';

/** Dört komşu: +x, -x, +z, -z. Çit bağlantı maskesinin bit sırası bu sıradır. */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const HALF = GRID_SIZE / 2;

export const cidx = (i: number, j: number): number => j * GRID_SIZE + i;
export const inGrid = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < GRID_SIZE && j < GRID_SIZE;
export const cellCoords = (c: number): [number, number] => [c % GRID_SIZE, Math.floor(c / GRID_SIZE)];
export const cellCenter = (i: number, j: number): [number, number] => [i - HALF + 0.5, j - HALF + 0.5];
export const cellOf = (x: number, z: number): [number, number] => [
  Math.floor(x + HALF),
  Math.floor(z + HALF),
];
/** Dünya noktasının hücre indeksi; ızgara dışında -1. */
export function cellIndexAt(x: number, z: number): number {
  const [i, j] = cellOf(x, z);
  return inGrid(i, j) ? cidx(i, j) : -1;
}
