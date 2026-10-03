import { describe, expect, it } from 'vitest';
import { GRID_SIZE } from '../src/content/island';
import { DIRS, HALF, cellCenter, cellCoords, cellIndexAt, cellOf, cidx, inGrid } from '../src/grid';

describe('grid', () => {
  it('64×64 ızgara, merkez (0,0) hücre köşesindedir', () => {
    expect(GRID_SIZE).toBe(64);
    expect(HALF).toBe(32);
    expect(cellCenter(32, 32)).toEqual([0.5, 0.5]);
    expect(cellCenter(31, 31)).toEqual([-0.5, -0.5]);
  });
  it('cidx/cellCoords birbirinin tersidir', () => {
    expect(cidx(5, 7)).toBe(7 * 64 + 5);
    expect(cellCoords(cidx(5, 7))).toEqual([5, 7]);
  });
  it('cellOf dünya koordinatını hücreye çevirir', () => {
    expect(cellOf(0.5, 0.5)).toEqual([32, 32]);
    expect(cellOf(-0.1, -0.1)).toEqual([31, 31]);
    expect(cellOf(-32, 31.99)).toEqual([0, 63]);
  });
  it('inGrid ve cellIndexAt sınırları', () => {
    expect(inGrid(0, 0)).toBe(true);
    expect(inGrid(64, 0)).toBe(false);
    expect(inGrid(-1, 3)).toBe(false);
    expect(cellIndexAt(0.5, 0.5)).toBe(cidx(32, 32));
    expect(cellIndexAt(40, 0)).toBe(-1);
  });
  it('DIRS dört komşu, +x,-x,+z,-z sırasıyla (çit maskesi bu sıraya bağlı)', () => {
    expect(DIRS).toEqual([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]);
  });
});
