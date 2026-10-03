import { BUILDINGS } from './content/buildings';
import { CREATURES } from './content/creatures';
import { HEARTH_CELLS } from './content/island';
import { PLAYER } from './content/player';
import {
  BUSH_SPAWN,
  NODE_YIELD,
  RESOURCE_COUNTS,
  RESOURCE_SPAWN,
  START_RESOURCES,
} from './content/resources';
import { DAY_S, secondsToTicks } from './content/time';
import { refreshFlow } from './flow';
import { cellCenter, cellCoords, cidx } from './grid';
import { generateIsland } from './island';
import { footprintCells, randomFreeCell } from './placement';
import { createRng } from './rng';
import type {
  Building,
  BuildingKind,
  Creature,
  CreatureKind,
  EntityId,
  GameState,
  Player,
  ResourceKind,
  ResourceNode,
  Rotation,
  Vec2,
} from './types';

/** Tablo anahtarları artan id sırasıyla — iterasyon sırası her yerde bu. */
export function ids<T>(table: Record<number, T>): number[] {
  return Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
}
export function nextRandom(state: GameState): number {
  const r = createRng(state.rng);
  const v = r.next();
  state.rng = r.state();
  return v;
}
export function randInt(state: GameState, min: number, maxExclusive: number): number {
  const r = createRng(state.rng);
  const v = r.int(min, maxExclusive);
  state.rng = r.state();
  return v;
}
export function allocId(state: GameState): EntityId {
  return state.nextId++;
}

export function buildingCenter(b: Building): Vec2 {
  let x = 0;
  let z = 0;
  for (const c of b.cells) {
    const [i, j] = cellCoords(c);
    const [cx, cz] = cellCenter(i, j);
    x += cx / b.cells.length;
    z += cz / b.cells.length;
  }
  return { x, z };
}

/** Kural kontrolü yapmaz (çağıran `evaluatePlacement` ile doğrular). */
export function addBuilding(
  state: GameState,
  kind: BuildingKind,
  i: number,
  j: number,
  rot: Rotation,
): Building {
  const id = allocId(state);
  const cells = footprintCells(kind, i, j).map(([ci, cj]) => cidx(ci, cj));
  const b: Building = { id, kind, i, j, rot, hp: BUILDINGS[kind].hp, cells, nextShotTick: 0 };
  for (const c of cells) state.occ[c] = id;
  state.buildings[id] = b;
  state.flowDirty = true;
  return b;
}
export function spawnNode(state: GameState, kind: ResourceKind, i: number, j: number): ResourceNode {
  const id = allocId(state);
  const n: ResourceNode = { id, kind, i, j, hitsLeft: NODE_YIELD[kind].hits, bornTick: state.tick };
  state.occ[cidx(i, j)] = id;
  state.nodes[id] = n;
  state.flowDirty = true;
  return n;
}
export function spawnCreature(state: GameState, kind: CreatureKind, x: number, z: number): Creature {
  const id = allocId(state);
  const c: Creature = {
    id,
    kind,
    x,
    z,
    yaw: Math.atan2(-x, -z),
    hp: CREATURES[kind].hp,
    targetId: 0,
    nextAttackTick: 0,
    bornTick: state.tick,
  };
  state.creatures[id] = c;
  return c;
}
export function spawnPlayer(state: GameState): Player {
  const id = allocId(state);
  const p: Player = {
    id,
    x: PLAYER.respawnPos.x,
    z: PLAYER.respawnPos.z,
    yaw: 0,
    hp: PLAYER.maxHp,
    dead: false,
    respawnAtTick: 0,
    axeReadyTick: 0,
    swingTick: -1000,
    god: false,
  };
  state.players[id] = p;
  return p;
}

const emptyFlow = () => ({ dist: [] as number[], next: [] as number[] });

/** Yeni run: ada, Hearth, kaynaklar, oyuncu, flow alanları. Aynı seed → aynı durum. */
export function createGame(seed: number): GameState {
  const island = generateIsland(seed);
  const state: GameState = {
    seed,
    tick: 0,
    nextId: 1,
    rng: (seed ^ 0x9e3779b9) >>> 0,
    phase: 'day',
    day: 1,
    night: 0,
    phaseStartTick: 0,
    phaseEndTick: secondsToTicks(DAY_S),
    over: false,
    island,
    occ: new Array<number>(island.level.length).fill(0),
    resources: { ...START_RESOURCES },
    players: {},
    nodes: {},
    buildings: {},
    creatures: {},
    projectiles: {},
    hearthId: 0,
    pendingRespawns: [],
    wavesSpawned: 0,
    flow: { hearth: emptyFlow(), buildings: emptyFlow(), lanterns: emptyFlow() },
    flowDirty: true,
  };
  const [hi, hj] = HEARTH_CELLS[0] as readonly [number, number];
  state.hearthId = addBuilding(state, 'hearth', hi, hj, 0).id;
  const rand = () => nextRandom(state);
  const place = (kind: ResourceKind, count: number, opts: typeof RESOURCE_SPAWN | typeof BUSH_SPAWN) => {
    for (let n = 0; n < count; n++) {
      const cell = randomFreeCell(state, rand, opts);
      if (cell) spawnNode(state, kind, cell[0], cell[1]);
    }
  };
  place('tree', RESOURCE_COUNTS.tree, RESOURCE_SPAWN);
  place('rock', RESOURCE_COUNTS.rock, RESOURCE_SPAWN);
  place('bush', RESOURCE_COUNTS.bush, BUSH_SPAWN);
  spawnPlayer(state);
  refreshFlow(state);
  return state;
}
