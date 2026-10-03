import { NODE_YIELD, RESOURCE_SPAWN, RESPAWNS, RESPAWN_DELAY_S } from '../content/resources';
import { secondsToTicks } from '../content/time';
import { cellCenter, cidx } from '../grid';
import { randomFreeCell } from '../placement';
import { nextRandom, spawnNode } from '../state';
import type { EntityId, GameState, ResourceNode, SimEvent } from '../types';

/** Baltayla kaynağa vuruş; tükenince verim + yeniden doğma kuyruğu. */
export function hitNode(
  state: GameState,
  node: ResourceNode,
  fromX: number,
  fromZ: number,
  playerId: EntityId,
  events: SimEvent[],
): void {
  node.hitsLeft -= 1;
  if (node.hitsLeft > 0) return;
  const y = NODE_YIELD[node.kind];
  state.resources.wood += y.wood;
  state.resources.stone += y.stone;
  state.occ[cidx(node.i, node.j)] = 0;
  delete state.nodes[node.id];
  state.flowDirty = true;
  const [x, z] = cellCenter(node.i, node.j);
  events.push({ t: 'nodeRemoved', id: node.id, kind: node.kind, x, z, awayX: fromX, awayZ: fromZ });
  if (y.wood || y.stone) events.push({ t: 'resourceGained', playerId, wood: y.wood, stone: y.stone, x, z });
  if (RESPAWNS[node.kind])
    state.pendingRespawns.push({ kind: node.kind, atTick: state.tick + secondsToTicks(RESPAWN_DELAY_S) });
}

/** Süresi gelen yeniden doğmalar: rastgele uygun hücre; yer yoksa 1 sn sonra tekrar dener. */
export function updateRespawns(state: GameState, events: SimEvent[]): void {
  if (state.pendingRespawns.length === 0) return;
  const due = state.pendingRespawns.filter((r) => r.atTick <= state.tick);
  if (due.length === 0) return;
  state.pendingRespawns = state.pendingRespawns.filter((r) => r.atTick > state.tick);
  for (const r of due) {
    const cell = randomFreeCell(state, () => nextRandom(state), RESOURCE_SPAWN);
    if (!cell) {
      state.pendingRespawns.push({ kind: r.kind, atTick: state.tick + secondsToTicks(RESPAWN_DELAY_S) });
      continue;
    }
    const node = spawnNode(state, r.kind, cell[0], cell[1]);
    const [x, z] = cellCenter(cell[0], cell[1]);
    events.push({ t: 'nodeSpawned', id: node.id, kind: node.kind, x, z });
  }
}
