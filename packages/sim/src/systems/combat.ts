import { PLAYER } from '../content/player';
import { secondsToTicks } from '../content/time';
import { buildingCenter } from '../state';
import type { Building, EntityId, GameState, SimEvent } from '../types';

/** Yaratığa hasar; öldüyse siler ve true döner. `emitHit` ayrık vuruşlarda (balta, ok) true. */
export function damageCreature(
  state: GameState,
  id: EntityId,
  dmg: number,
  events: SimEvent[],
  emitHit = true,
): boolean {
  const c = state.creatures[id];
  if (!c) return false;
  c.hp -= dmg;
  if (emitHit) events.push({ t: 'hit', targetId: id, x: c.x, z: c.z, damage: dmg });
  if (c.hp > 0) return false;
  delete state.creatures[id];
  events.push({ t: 'creatureDied', id, kind: c.kind, x: c.x, z: c.z });
  return true;
}

export function damagePlayer(state: GameState, id: EntityId, dmg: number, events: SimEvent[]): void {
  const p = state.players[id];
  if (!p || p.dead || p.god) return;
  p.hp -= dmg;
  if (p.hp > 0) return;
  p.hp = 0;
  p.dead = true;
  p.respawnAtTick = state.tick + secondsToTicks(PLAYER.respawnDelayS);
  events.push({ t: 'playerDied', playerId: id });
}

export function removeBuilding(state: GameState, b: Building, events: SimEvent[]): void {
  for (const c of b.cells) state.occ[c] = 0;
  delete state.buildings[b.id];
  state.flowDirty = true;
  const { x, z } = buildingCenter(b);
  events.push({ t: 'buildingDestroyed', id: b.id, kind: b.kind, x, z });
  if (b.id === state.hearthId && !state.over) {
    state.over = true;
    events.push({ t: 'gameOver' });
  }
}

export function damageBuilding(state: GameState, id: EntityId, dmg: number, events: SimEvent[]): void {
  const b = state.buildings[id];
  if (!b) return;
  b.hp -= dmg;
  if (b.hp <= 0) removeBuilding(state, b, events);
}
