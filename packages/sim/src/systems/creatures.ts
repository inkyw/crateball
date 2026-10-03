import { ATTACK_REACH, BUILDINGS } from '../content/buildings';
import {
  CHASE_BLOCKED_FRACTION,
  CONTACT_MARGIN,
  CONTACT_PASSES,
  CREATURES,
  SEPARATION,
} from '../content/creatures';
import { PLAYER } from '../content/player';
import { DT, secondsToTicks } from '../content/time';
import { cellCenter, cellCoords, cellIndexAt } from '../grid';
import { moveCircle } from '../movement';
import { circleOverlapsCell } from '../placement';
import { buildingCenter, ids } from '../state';
import type { Building, Creature, FlowField, GameState, Player, SimEvent } from '../types';
import { damageBuilding, damageCreature, damagePlayer } from './combat';

const LANTERN = BUILDINGS.lantern;

/** Herhangi bir fenerin ışık yarıçapı (4) içinde mi. */
export function inLanternLight(state: GameState, x: number, z: number): boolean {
  const r2 = (LANTERN.lightRadius as number) ** 2;
  for (const id of ids(state.buildings)) {
    const b = state.buildings[id]!;
    if (b.kind !== 'lantern') continue;
    const c = buildingCenter(b);
    if ((c.x - x) ** 2 + (c.z - z) ** 2 <= r2) return true;
  }
  return false;
}

export function nearestLivePlayer(state: GameState, x: number, z: number, range: number): Player | null {
  let best: Player | null = null;
  let bestD2 = range * range;
  for (const id of ids(state.players)) {
    const p = state.players[id]!;
    if (p.dead) continue;
    const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return best;
}

function fieldFor(state: GameState, c: Creature): FlowField {
  if (c.kind === 'stumpkin') return state.flow.buildings;
  if (c.kind === 'glowbug') return state.flow.lanterns;
  return state.flow.hearth;
}

function attackBuilding(state: GameState, c: Creature, b: Building, events: SimEvent[]): void {
  c.targetId = b.id;
  const def = CREATURES[c.kind];
  if (def.attackDamage !== undefined) {
    if (state.tick < c.nextAttackTick) return;
    c.nextAttackTick = state.tick + secondsToTicks(def.attackIntervalS as number);
    damageBuilding(state, b.id, def.attackDamage, events);
  } else damageBuilding(state, b.id, (def.contactDps as number) * DT, events);
}

/** Ayrışma itmeleri: iki geçiş (önce hesapla, sonra uygula) — sıra bağımsız ve deterministik. */
function separation(state: GameState, list: number[]): Map<number, { x: number; z: number }> {
  const push = new Map<number, { x: number; z: number }>();
  const add = (id: number, x: number, z: number) => {
    const p = push.get(id) ?? { x: 0, z: 0 };
    p.x += x;
    p.z += z;
    push.set(id, p);
  };
  for (let a = 0; a < list.length; a++)
    for (let b = a + 1; b < list.length; b++) {
      const ca = state.creatures[list[a] as number]!;
      const cb = state.creatures[list[b] as number]!;
      const dx = cb.x - ca.x;
      const dz = cb.z - ca.z;
      const d = Math.hypot(dx, dz);
      if (d >= SEPARATION.radius) continue;
      const f = ((SEPARATION.radius - d) / SEPARATION.radius) * SEPARATION.force * DT;
      // Üst üste doğanlar: id sırasına göre sabit yönde ayrıl.
      const ux = d > 1e-6 ? dx / d : 1;
      const uz = d > 1e-6 ? dz / d : 0;
      add(ca.id, -ux * f, -uz * f);
      add(cb.id, ux * f, uz * f);
    }
  // Toplam itme sınırı: yoğun sürüde adım bir hücreyi aşmasın (moveCircle sözleşmesi).
  for (const v of push.values()) {
    const len = Math.hypot(v.x, v.z);
    if (len > SEPARATION.maxPush) {
      v.x = (v.x / len) * SEPARATION.maxPush;
      v.z = (v.z / len) * SEPARATION.maxPush;
    }
  }
  return push;
}

/** Oyuncu–yaratık daire teması (spec §3.2): ikisi de yarı yarıya itilir; arazi/bina kuralları korunur. */
function resolveUnitContacts(state: GameState): void {
  for (let pass = 0; pass < CONTACT_PASSES; pass++) {
    let any = false;
    for (const pid of ids(state.players)) {
      const p = state.players[pid]!;
      if (p.dead) continue;
      for (const cid of ids(state.creatures)) {
        const c = state.creatures[cid]!;
        const cr = CREATURES[c.kind].radius;
        const minD = PLAYER.radius + cr;
        const dx = c.x - p.x;
        const dz = c.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d >= minD) continue;
        any = true;
        const ux = d > 1e-6 ? dx / d : 1;
        const uz = d > 1e-6 ? dz / d : 0;
        const half = (minD - d) / 2;
        const nc = moveCircle(state, c.x, c.z, ux * half, uz * half, cr);
        c.x = nc.x;
        c.z = nc.z;
        const np = moveCircle(state, p.x, p.z, -ux * half, -uz * half, PLAYER.radius);
        p.x = np.x;
        p.z = np.z;
        // Artık nüfuz: arazi/bina bir tarafı durdurduysa kalanı diğer tarafa (geçerli hareketle) aktar.
        const rx = c.x - p.x;
        const rz = c.z - p.z;
        const rd = Math.hypot(rx, rz);
        if (rd >= minD) continue;
        const vx = rd > 1e-6 ? rx / rd : ux;
        const vz = rd > 1e-6 ? rz / rd : uz;
        const rest = minD - rd;
        const nc2 = moveCircle(state, c.x, c.z, vx * rest, vz * rest, cr);
        c.x = nc2.x;
        c.z = nc2.z;
        const rd2 = Math.hypot(c.x - p.x, c.z - p.z);
        if (rd2 < minD) {
          const np2 = moveCircle(state, p.x, p.z, -vx * (minD - rd2), -vz * (minD - rd2), PLAYER.radius);
          p.x = np2.x;
          p.z = np2.z;
        }
      }
    }
    if (!any) return;
  }
}

export function updateCreatures(state: GameState, events: SimEvent[]): void {
  const list = ids(state.creatures);
  const push = separation(state, list);
  for (const id of list) {
    const c = state.creatures[id];
    if (!c) continue;
    const def = CREATURES[c.kind];
    const lit = inLanternLight(state, c.x, c.z);
    if (
      lit &&
      c.kind === 'shadeling' &&
      damageCreature(state, id, (LANTERN.shadelingDps as number) * DT, events, false)
    )
      continue;
    const speed = def.speed * (lit ? 1 - (LANTERN.slowFactor as number) : 1);
    const sep = push.get(id) ?? { x: 0, z: 0 };
    /** Hareket dener; ayrışma itmesi yalnızca ilk çağrıda eklenir. Dönüş: istenen yolun gerçekleşen oranı. */
    const tryMove = (dx: number, dz: number): number => {
      const sx = dx + sep.x;
      const sz = dz + sep.z;
      sep.x = sep.z = 0;
      if (sx === 0 && sz === 0) return 1;
      const np = moveCircle(state, c.x, c.z, sx, sz, def.radius);
      const moved = Math.hypot(np.x - c.x, np.z - c.z);
      c.x = np.x;
      c.z = np.z;
      const want = Math.hypot(sx, sz);
      return want > 1e-9 ? moved / want : 1;
    };
    /** Flow alanı: sıradaki hücre bina ise (erişimdeyse) saldır, değilse ona yürü. */
    const followFlow = (): void => {
      const here = cellIndexAt(c.x, c.z);
      const n = here >= 0 ? (fieldFor(state, c).next[here] ?? -1) : -1;
      if (n < 0) {
        tryMove(0, 0);
        return;
      }
      const [ni, nj] = cellCoords(n);
      const [tx, tz] = cellCenter(ni, nj);
      const dx = tx - c.x;
      const dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      c.yaw = Math.atan2(dx, dz);
      const occId = state.occ[n] ?? 0;
      const b = occId ? state.buildings[occId] : undefined;
      if (b && circleOverlapsCell(c.x, c.z, def.radius + ATTACK_REACH, ni, nj)) {
        attackBuilding(state, c, b, events);
        tryMove(0, 0);
      } else if (d > 1e-6) tryMove((dx / d) * speed * DT, (dz / d) * speed * DT);
      else tryMove(0, 0);
    };
    c.targetId = 0;
    let handled = false;
    if (c.kind === 'shadeling') {
      const target = nearestLivePlayer(state, c.x, c.z, def.aggroRange as number);
      if (target) {
        c.targetId = target.id;
        const dx = target.x - c.x;
        const dz = target.z - c.z;
        const d = Math.hypot(dx, dz);
        c.yaw = Math.atan2(dx, dz);
        if (d <= def.radius + PLAYER.radius + CONTACT_MARGIN) {
          damagePlayer(state, target.id, (def.contactDps as number) * DT, events);
          tryMove(0, 0);
          handled = true;
        } else if (tryMove((dx / d) * speed * DT, (dz / d) * speed * DT) >= CHASE_BLOCKED_FRACTION)
          handled = true;
        // Engellendi (çit, yar, ağaç): flow alanına düş; önündeki bina varsa ona saldırır.
      }
    }
    if (!handled) followFlow();
  }
  resolveUnitContacts(state);
}
