export const PLAYER = {
  name: 'Woodcutter',
  speed: 4,
  radius: 0.35,
  maxHp: 100,
  respawnDelayS: 5,
  /** Ölünce burada doğar (Hearth'ın hemen güneyi, meydan içi); doluysa çevresi taranır. */
  respawnPos: { x: 0, z: 3.5 },
} as const;
/** Doğma hücresi doluysa bu Chebyshev yarıçapına kadar komşu hücreler sabit sırayla denenir. */
export const RESPAWN_SEARCH_RADIUS = 4;

export const AXE = {
  cooldownS: 0.5,
  arcDeg: 100,
  range: 1.3,
  creatureDamage: 12,
  /** Kaynak hücresinin merkezi hedeflenir; yarım hücre (0.5) menzile eklenir. */
  cellReach: 0.5,
} as const;
