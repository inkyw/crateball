import type { ResourceKind } from '../types';
import { ISLAND_RADIUS } from './island';

export const RESOURCE_COUNTS: Record<ResourceKind, number> = { tree: 14, rock: 8, bush: 7 };
export const NODE_YIELD: Record<ResourceKind, { hits: number; wood: number; stone: number }> = {
  tree: { hits: 4, wood: 3, stone: 0 },
  rock: { hits: 4, wood: 0, stone: 2 },
  bush: { hits: 2, wood: 0, stone: 0 },
};
/** Tükenen ağaç/kaya yeniden doğar; çalı doğmaz (dekor). */
export const RESPAWNS: Record<ResourceKind, boolean> = { tree: true, rock: true, bush: false };
export const RESPAWN_DELAY_S = 1;
export const START_RESOURCES = { wood: 10, stone: 0 } as const;
/** Yeni kaynak hücresi: Hearth'tan ≥ minR, kıyıdan içeride, çevresindeki `gap` halkası boş ve rampa değil. */
export const RESOURCE_SPAWN = { minR: 7.5, maxR: ISLAND_RADIUS - 2, gap: 1 } as const;
export const BUSH_SPAWN = { minR: 6.5, maxR: ISLAND_RADIUS - 2, gap: 0 } as const;
