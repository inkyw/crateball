/** Ada ızgarası (spec §3.1.1, design notes "Ada"). */
export const GRID_SIZE = 64;
export const ISLAND_RADIUS = 22;
export const PLAZA_RADIUS = 7;
export const WATER = -1;
export const LEVEL_GROUND = 1;
export const LEVEL_HILL = 2;
/** Tepeler: birbirinden ayrık, her biri doğrulanmış 3 hücrelik rampalı; son sayı 4–5 (spec §3.1.1). */
export const HILL_COUNT_MIN = 4;
export const HILL_COUNT_MAX = 5;
/** Aday üretimi üst sınırı (deterministik fallback: bulunamazsa daha az tepe kalır). */
export const HILL_TRIES = 600;
/** Tepe merkezi Hearth'tan bu uzaklık aralığında (birim). */
export const HILL_CENTER_MIN_R = 9;
export const HILL_CENTER_MAX_R = 17;
/** Tepe merkezi kıyıdan en az bu kadar hücre içeride; tepe hücreleri en az HILL_CELL_MIN_WATER_DIST. */
export const HILL_MIN_WATER_DIST = 5;
export const HILL_CELL_MIN_WATER_DIST = 3;
/** Tepe yarıçapı (hücre): min + rand × aralık; en az MIN_HILL_CELLS hücre. */
export const HILL_RADIUS_MIN = 1.6;
export const HILL_RADIUS_RANGE = 1.3;
export const MIN_HILL_CELLS = 6;
/** İki tepe arasında en az bu kadar hücre boşluk (Chebyshev). */
export const HILL_GAP_CELLS = 5;
export const RAMP_WIDTH = 3;
/** Hearth 2×2: ızgara merkezindeki dört hücre; dünya merkezi (0,0). */
export const HEARTH_CELLS: ReadonlyArray<readonly [number, number]> = [
  [31, 31],
  [32, 31],
  [31, 32],
  [32, 32],
];
export const HEARTH_POS = { x: 0, z: 0 } as const;
/** Bu yarıçap içine bina konamaz. */
export const HEARTH_SAFE_RADIUS = 2.6;
/** Suya bu kadar hücreden yakın yere (kumsal dalga çizgisi) bina konamaz. */
export const SURF_LINE_CELLS = 2;
