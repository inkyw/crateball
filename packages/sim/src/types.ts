/** Sim durumu düz JSON'dur: Map/Set/TypedArray/sınıf yok; hashState ile karşılaştırılabilir. */
export type EntityId = number;
export type CellIndex = number;
export type Phase = 'day' | 'night';
export type ResourceKind = 'tree' | 'rock' | 'bush';
export type BuildingKind = 'hearth' | 'fence' | 'arrowTower' | 'lantern';
export type BuildableKind = Exclude<BuildingKind, 'hearth'>;
export type CreatureKind = 'shadeling' | 'stumpkin' | 'glowbug';
export type Rotation = 0 | 1 | 2 | 3;

/** Flow field'da ulaşılamayan hücre (Infinity JSON'da null olurdu). `WATER` yalnızca content/island.ts'te tanımlıdır. */
export const UNREACHABLE = 1e9;

export interface Vec2 {
  x: number;
  z: number;
}

/** Rampa: k alt kat (1), (dx,dz) yukarı yönü. */
export interface Ramp {
  k: number;
  dx: number;
  dz: number;
}

export interface IslandGrid {
  size: number;
  /** WATER (-1), 1 zemin, 2 tepe. */
  level: number[];
  ramp: (Ramp | null)[];
  /** En yakın su / kara hücresine BFS mesafesi. */
  dWater: number[];
  dLand: number[];
}

export interface Player {
  id: EntityId;
  x: number;
  z: number;
  /** Bakış yönü: atan2(dx, dz) — ileri vektörü (sin yaw, cos yaw). */
  yaw: number;
  hp: number;
  dead: boolean;
  respawnAtTick: number;
  axeReadyTick: number;
  /** Son balta sallama tick'i (render animasyonu için). */
  swingTick: number;
  god: boolean;
}

export interface ResourceNode {
  id: EntityId;
  kind: ResourceKind;
  i: number;
  j: number;
  hitsLeft: number;
  /** Doğduğu tick (büyüme animasyonu için). */
  bornTick: number;
}

export interface Building {
  id: EntityId;
  kind: BuildingKind;
  /** Ayak izinin sol-üst hücresi. */
  i: number;
  j: number;
  rot: Rotation;
  hp: number;
  cells: CellIndex[];
  nextShotTick: number;
}

export interface Creature {
  id: EntityId;
  kind: CreatureKind;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  /** Saldırdığı bina ya da kovaladığı oyuncu; 0 = yok. */
  targetId: EntityId;
  nextAttackTick: number;
  bornTick: number;
}

export interface Projectile {
  id: EntityId;
  x: number;
  z: number;
  targetId: EntityId;
  damage: number;
}

export interface FlowField {
  /** Hedefe maliyet; UNREACHABLE ulaşılamaz. */
  dist: number[];
  /** Hedefe doğru bir sonraki hücre; -1 yok. */
  next: number[];
}

/** Bir varlığın konum/yön özeti; istemci bir önceki tick'i saklayıp interpolasyon yapar (Session.prev). */
export interface Pose {
  x: number;
  z: number;
  yaw: number;
}
export interface PoseSnapshot {
  players: Record<EntityId, Pose>;
  creatures: Record<EntityId, Pose>;
  projectiles: Record<EntityId, Pose>;
}

export interface PendingRespawn {
  kind: ResourceKind;
  atTick: number;
}

export interface GameState {
  seed: number;
  tick: number;
  nextId: EntityId;
  /** createRng iç durumu; her kullanımda ilerletilir. */
  rng: number;
  phase: Phase;
  day: number;
  /** Tamamlanan ya da süren gece sayısı (gündüz 1'de 0). */
  night: number;
  phaseStartTick: number;
  phaseEndTick: number;
  over: boolean;
  island: IslandGrid;
  /** Hücredeki varlık id'si (kaynak ya da bina); 0 boş. */
  occ: EntityId[];
  resources: { wood: number; stone: number };
  players: Record<EntityId, Player>;
  nodes: Record<EntityId, ResourceNode>;
  buildings: Record<EntityId, Building>;
  creatures: Record<EntityId, Creature>;
  projectiles: Record<EntityId, Projectile>;
  hearthId: EntityId;
  pendingRespawns: PendingRespawn[];
  wavesSpawned: number;
  flow: { hearth: FlowField; buildings: FlowField; lanterns: FlowField };
  flowDirty: boolean;
}

export interface PlaceCommand {
  kind: BuildableKind;
  /** Kule/fener: ayak izinin sol-üst hücresi. Çit: `cells` kullanılır, i/j ilk hücredir. */
  i: number;
  j: number;
  rot: Rotation;
  /** Çit hattı (düz, aynı i ya da aynı j). Diğer binalarda yok sayılır. */
  cells?: [number, number][];
}

export interface PlayerInput {
  playerId: EntityId;
  /** -1..1; birimden uzun vektör normalize edilir. */
  move: Vec2;
  /** Nişan noktası (dünya); yoksa bakış yönü değişmez. */
  aim: Vec2 | null;
  attack: boolean;
  place: PlaceCommand | null;
}

export type SimEvent =
  | { t: 'hit'; targetId: EntityId; x: number; z: number; damage: number }
  | { t: 'resourceGained'; playerId: EntityId; wood: number; stone: number; x: number; z: number }
  | { t: 'nodeRemoved'; id: EntityId; kind: ResourceKind; x: number; z: number; awayX: number; awayZ: number }
  | { t: 'nodeSpawned'; id: EntityId; kind: ResourceKind; x: number; z: number }
  | { t: 'built'; id: EntityId; kind: BuildingKind; cells: CellIndex[] }
  | { t: 'buildRejected'; playerId: EntityId; reason: string }
  | { t: 'buildingDestroyed'; id: EntityId; kind: BuildingKind; x: number; z: number }
  | { t: 'creatureSpawned'; id: EntityId; kind: CreatureKind; x: number; z: number }
  | { t: 'creatureDied'; id: EntityId; kind: CreatureKind; x: number; z: number }
  | { t: 'playerDied'; playerId: EntityId }
  | { t: 'playerRespawned'; playerId: EntityId }
  | { t: 'phaseChanged'; phase: Phase; day: number; night: number }
  | { t: 'arrowFired'; buildingId: EntityId; projectileId: EntityId }
  | { t: 'gameOver' };

export interface StepResult {
  state: GameState;
  events: SimEvent[];
}
