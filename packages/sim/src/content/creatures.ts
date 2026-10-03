import type { CreatureKind } from '../types';

export interface CreatureDef {
  name: string;
  speed: number;
  hp: number;
  radius: number;
  /** Shadeling: bu mesafede oyuncu görürse ona koşar. */
  aggroRange?: number;
  /** Temas hasarı (saniyede), her tick DT ile çarpılır. */
  contactDps?: number;
  /** Stumpkin: vuruş başına hasar ve vuruş aralığı. */
  attackDamage?: number;
  attackIntervalS?: number;
}

export const CREATURES: Record<CreatureKind, CreatureDef> = {
  shadeling: { name: 'Shadeling', speed: 3.2, hp: 20, radius: 0.35, aggroRange: 6, contactDps: 8 },
  stumpkin: { name: 'Stumpkin', speed: 1.4, hp: 120, radius: 0.45, attackDamage: 20, attackIntervalS: 1.5 },
  glowbug: { name: 'Glowbug', speed: 2.6, hp: 15, radius: 0.25, contactDps: 10 },
};
/** Ayrışma: bu mesafeden yakın yaratıklar birbirini bu kuvvetle (u/s) iter. */
export const SEPARATION = {
  radius: 0.6,
  force: 2,
  /** Tick başına toplam itme üst sınırı (birim); adım bir hücreden küçük kalır. */ maxPush: 0.15,
} as const;
/** Daire teması: yarıçaplar toplamına eklenen pay (temas hasarı). */
export const CONTACT_MARGIN = 0.05;
/** Kovalayan Shadeling istediği yolun bu oranından azını gidebildiyse engellenmiş sayılır → flow alanına düşer. */
export const CHASE_BLOCKED_FRACTION = 0.25;
/** Oyuncu–yaratık temas çözümünde tick başına en fazla geçiş sayısı. */
export const CONTACT_PASSES = 3;
