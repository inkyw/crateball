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

/** Arazi şekli (kit `buildLevels` ile aynı): kıyı çizgisi gürültüsü ve yükseklik. */
export const TERRAIN_EDGE_NOISE_FREQ = 0.11;
export const TERRAIN_EDGE_NOISE_OFFSET_X = 3.1;
export const TERRAIN_EDGE_NOISE_OFFSET_Z = -1.7;
export const TERRAIN_EDGE_NOISE_OCTAVES = 4;
export const TERRAIN_EDGE_NOISE_MID = 0.5;
export const TERRAIN_EDGE_NOISE_AMOUNT = 0.6;
export const TERRAIN_EDGE_SMOOTH_FROM = 0.5;
export const TERRAIN_EDGE_SMOOTH_TO = 1.0;
export const TERRAIN_HEIGHT_FREQ = 0.07;
export const TERRAIN_HEIGHT_OFFSET_X = 10;
export const TERRAIN_HEIGHT_OFFSET_Z = 0;
export const TERRAIN_HEIGHT_SEED_SHIFT = 7;
export const TERRAIN_HEIGHT_OCTAVES = 3;
export const TERRAIN_HEIGHT_BASE = 0.9;
export const TERRAIN_HEIGHT_AMPLITUDE = 2.4;
export const TERRAIN_HEIGHT_BIAS = -0.45;
/** Bu yükseklik ve üstü kara. */
export const TERRAIN_LAND_THRESHOLD = 0.02;
/** Çoğunluk filtresi: geçiş sayısı ve değişim için gereken komşu (3×3) sayısı. */
export const TERRAIN_SMOOTH_PASSES = 2;
export const TERRAIN_SMOOTH_MIN_VOTES = 5;
/** Tepe üretimi: seed tuzları, aday çevresi pencere yarıçapı ve blob gürültüsü. */
export const HILL_SEED_SALT = 99;
export const RAMP_SEED_SALT = 777;
export const HILL_WINDOW = 4;
export const HILL_BLOB_FREQ = 0.9;
export const HILL_BLOB_SEED = 61;
export const HILL_BLOB_MID = 0.5;
export const HILL_BLOB_AMOUNT = 1.2;
