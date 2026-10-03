import { BUILDINGS, PROJECTILE_SPEED } from '../content/buildings';
import { DT, secondsToTicks } from '../content/time';
import { allocId, buildingCenter, ids } from '../state';
import type { GameState, SimEvent } from '../types';
import { damageCreature } from './combat';

const TOWER = BUILDINGS.arrowTower;

/** Her kule: bekleme bittiyse menzildeki en yakın yaratığa (eşitlikte küçük id) ok. */
export function updateTowers(state: GameState, events: SimEvent[]): void {
  const range2 = (TOWER.range as number) ** 2;
  for (const id of ids(state.buildings)) {
    const b = state.buildings[id]!;
    if (b.kind !== 'arrowTower' || state.tick < b.nextShotTick) continue;
    const c = buildingCenter(b);
    let target = 0;
    let bestD2 = range2;
    for (const cid of ids(state.creatures)) {
      const cr = state.creatures[cid]!;
      const d2 = (cr.x - c.x) ** 2 + (cr.z - c.z) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        target = cid;
      }
    }
    if (!target) continue;
    b.nextShotTick = state.tick + secondsToTicks(TOWER.fireIntervalS as number);
    const pid = allocId(state);
    state.projectiles[pid] = { id: pid, x: c.x, z: c.z, targetId: target, damage: TOWER.damage as number };
    events.push({ t: 'arrowFired', buildingId: id, projectileId: pid });
  }
}

/** Oklar hedefe güdümlü uçar; hedef yoksa silinir; varınca hasar verir. */
export function updateProjectiles(state: GameState, events: SimEvent[]): void {
  const stepLen = PROJECTILE_SPEED * DT;
  for (const id of ids(state.projectiles)) {
    const p = state.projectiles[id]!;
    const t = state.creatures[p.targetId];
    if (!t) {
      delete state.projectiles[id];
      continue;
    }
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d <= stepLen) {
      damageCreature(state, t.id, p.damage, events);
      delete state.projectiles[id];
      continue;
    }
    p.x += (dx / d) * stepLen;
    p.z += (dz / d) * stepLen;
  }
}
