import type { BuildableKind, BuildingKind } from '../types';

export interface BuildingDef {
  name: string;
  cost: { wood: number; stone: number };
  hp: number;
  /** Ayak izi kenarı (1 → 1×1, 2 → 2×2). */
  size: 1 | 2;
  range?: number;
  fireIntervalS?: number;
  damage?: number;
  lightRadius?: number;
  /** Işık içindeki yaratık hızının düşürüldüğü oran (0.4 → %40 yavaş). */
  slowFactor?: number;
  shadelingDps?: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  hearth: { name: 'The Hearth', cost: { wood: 0, stone: 0 }, hp: 500, size: 2 },
  fence: { name: 'Fence', cost: { wood: 5, stone: 0 }, hp: 60, size: 1 },
  arrowTower: {
    name: 'Arrow Tower',
    cost: { wood: 12, stone: 6 },
    hp: 150,
    size: 2,
    range: 7,
    fireIntervalS: 1,
    damage: 10,
  },
  lantern: {
    name: 'Lantern',
    cost: { wood: 4, stone: 2 },
    hp: 40,
    size: 1,
    lightRadius: 4,
    slowFactor: 0.4,
    shadelingDps: 3,
  },
};
/** İnşa hotbar'ı: 1, 2, 3 tuşları. */
export const HOTBAR: readonly BuildableKind[] = ['fence', 'arrowTower', 'lantern'];
/** Flow field'da bina hücresine girme maliyeti (normal hücre 1). */
export const BLOCKED_CELL_COST = 8;
export const PROJECTILE_SPEED = 14;
/** Yaratığın bir bina hücresine vurabilmesi için daire kenarı ile hücre arasındaki pay. */
export const ATTACK_REACH = 0.3;
