import type { CreatureKind } from '../types';

export interface WaveDef extends Record<CreatureKind, number> {
  /** Gecenin başından itibaren saniye. */
  atS: number;
}
export const NIGHT1_WAVES: readonly WaveDef[] = [
  { atS: 0, shadeling: 6, stumpkin: 0, glowbug: 1 },
  { atS: 25, shadeling: 4, stumpkin: 1, glowbug: 1 },
  { atS: 50, shadeling: 6, stumpkin: 1, glowbug: 2 },
];
export const NIGHT_SCALE_PER_NIGHT = 0.35;
/** Gece n için sayı çarpanı: ×(1 + 0.35·(n−1)); sayılar Math.round ile yuvarlanır. */
export const waveMultiplier = (night: number): number => 1 + NIGHT_SCALE_PER_NIGHT * (night - 1);
/** Doğma hücresi: su komşulu kara hücresi, Hearth'tan en az bu kadar uzak, Hearth'a yolu olan. */
export const SPAWN_MIN_DIST_FROM_HEARTH = 14;
/** Doğarken hücre merkezine eklenen rastgele kayma (hücre içinde kalır). */
export const SPAWN_JITTER = 0.3;
