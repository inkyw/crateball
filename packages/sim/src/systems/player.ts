import { CREATURES } from '../content/creatures';
import { LEVEL_GROUND } from '../content/island';
import { AXE, PLAYER, RESPAWN_SEARCH_RADIUS } from '../content/player';
import { DT, secondsToTicks } from '../content/time';
import { cellCenter, cellOf, cidx, inGrid } from '../grid';
import { moveCircle } from '../movement';
import { ids } from '../state';
import type { GameState, Player, PlayerInput, ResourceNode, SimEvent, Vec2 } from '../types';
import { damageCreature } from './combat';
import { hitNode } from './resources';

const ARC_HALF = (AXE.arcDeg / 2) * (Math.PI / 180);
const angleDiff = (a: number, b: number): number => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** (x,z) oyuncunun önündeki 100° yayda ve `reach` içinde mi. */
export function inArc(p: Player, x: number, z: number, reach: number): boolean {
  const dx = x - p.x;
  const dz = z - p.z;
  const d = Math.hypot(dx, dz);
  if (d > reach) return false;
  if (d < 1e-6) return true;
  return Math.abs(angleDiff(Math.atan2(dx, dz), p.yaw)) <= ARC_HALF;
}

/** Yaydaki tüm yaratıklara 12 hasar; yaratık yoksa yaydaki en yakın kaynağa 1 vuruş. */
function swingAxe(state: GameState, p: Player, events: SimEvent[]): void {
  let hitCreature = false;
  for (const id of ids(state.creatures)) {
    const c = state.creatures[id]!;
    if (!inArc(p, c.x, c.z, AXE.range + CREATURES[c.kind].radius)) continue;
    damageCreature(state, id, AXE.creatureDamage, events);
    hitCreature = true;
  }
  if (hitCreature) return;
  let best: ResourceNode | null = null;
  let bestD = Infinity;
  for (const id of ids(state.nodes)) {
    const n = state.nodes[id]!;
    const [x, z] = cellCenter(n.i, n.j);
    if (!inArc(p, x, z, AXE.range + AXE.cellReach)) continue;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  if (best) hitNode(state, best, p.x, p.z, p.id, events);
}

/**
 * Doğma noktası: Hearth yanındaki varsayılan hücre doluysa (çit vb.) etrafındaki halkalar sabit sırayla
 * taranır; ilk boş, su/rampa olmayan zemin hücresinin merkezi seçilir (deterministik).
 */
export function findRespawnPoint(state: GameState): Vec2 {
  const [ci, cj] = cellOf(PLAYER.respawnPos.x, PLAYER.respawnPos.z);
  for (let r = 0; r <= RESPAWN_SEARCH_RADIUS; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !inGrid(ci + di, cj + dj)) continue;
        const c = cidx(ci + di, cj + dj);
        if (state.island.level[c] !== LEVEL_GROUND || state.island.ramp[c] || state.occ[c]) continue;
        const [x, z] = cellCenter(ci + di, cj + dj);
        return r === 0 ? { x: PLAYER.respawnPos.x, z: PLAYER.respawnPos.z } : { x, z };
      }
  return { x: PLAYER.respawnPos.x, z: PLAYER.respawnPos.z };
}

export function updatePlayers(state: GameState, inputs: PlayerInput[], events: SimEvent[]): void {
  const byId = new Map(inputs.map((i) => [i.playerId, i] as const));
  for (const id of ids(state.players)) {
    const p = state.players[id]!;
    if (p.dead) {
      if (state.tick >= p.respawnAtTick) {
        const at = findRespawnPoint(state);
        p.x = at.x;
        p.z = at.z;
        p.hp = PLAYER.maxHp;
        p.dead = false;
        events.push({ t: 'playerRespawned', playerId: id });
      }
      continue;
    }
    const input = byId.get(id);
    if (!input) continue;
    let mx = input.move.x;
    let mz = input.move.z;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    if (len > 0) {
      const stepLen = PLAYER.speed * DT;
      const np = moveCircle(state, p.x, p.z, mx * stepLen, mz * stepLen, PLAYER.radius);
      p.x = np.x;
      p.z = np.z;
    }
    if (input.aim) {
      const dx = input.aim.x - p.x;
      const dz = input.aim.z - p.z;
      if (dx * dx + dz * dz > 1e-6) p.yaw = Math.atan2(dx, dz);
    } else if (len > 0) p.yaw = Math.atan2(mx, mz);
    if (input.attack && state.tick >= p.axeReadyTick) {
      p.axeReadyTick = state.tick + secondsToTicks(AXE.cooldownS);
      p.swingTick = state.tick;
      swingAxe(state, p, events);
    }
  }
}
