import {
  BUILDINGS,
  CREATURES,
  type GameState,
  PLAYER,
  buildingCenter,
  cellCenter,
  cellCoords,
  ids,
} from '@gg/sim';
import {
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
} from 'three';
import { DEBUG_VIEW as D } from './config';
import type { GameRenderer } from './renderer';

export interface DebugFlags {
  flow: boolean;
  colliders: boolean;
  grid: boolean;
  lanterns: boolean;
}
export interface DebugView {
  flags: DebugFlags;
  update(state: GameState): void;
}

function circle(out: number[], x: number, y: number, z: number, r: number, seg: number): void {
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    out.push(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r);
  }
}
function lines(color: number): LineSegments {
  const l = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({ color, transparent: true, opacity: D.opacity, depthTest: false }),
  );
  l.renderOrder = D.renderOrder;
  l.frustumCulled = false;
  l.visible = false;
  return l;
}
/**
 * Köşe verisini mevcut position attribute'una yazar (kapasite ikinin katı olarak büyür); her güncellemede yeni GPU
 * buffer'ı oluşturmaz. Büyümede eski GPU buffer'ı geometry.dispose() ile bırakılır (frustumCulled kapalı; bounding sphere gerekmez).
 */
export function setPoints(l: LineSegments, pts: ArrayLike<number>): void {
  const geo = l.geometry;
  let attr = geo.getAttribute('position') as Float32BufferAttribute | undefined;
  if (!attr || attr.array.length < pts.length) {
    let cap = Math.max(D.minCapacity, attr ? attr.array.length : 0);
    while (cap < pts.length) cap *= 2;
    if (attr) geo.dispose(); // eski GPU buffer'ı bırak; yenisi sonraki çizimde yüklenir
    attr = new Float32BufferAttribute(new Float32Array(cap), 3);
    attr.setUsage(DynamicDrawUsage);
    geo.setAttribute('position', attr);
  }
  (attr.array as Float32Array).set(pts as ArrayLike<number>);
  attr.needsUpdate = true;
  geo.setDrawRange(0, pts.length / 3);
}

/** F1 paneli anahtarları: flow okları (Hearth alanı), çarpıştırıcılar, fener yarıçapları; ızgara renderer'dan. */
export function createDebugView(renderer: GameRenderer): DebugView {
  const flags: DebugFlags = { flow: false, colliders: false, grid: false, lanterns: false };
  const flow = lines(D.flowColor);
  const colliders = lines(D.colliderColor);
  const lanterns = lines(D.lanternColor);
  renderer.debugGroup.add(flow, colliders, lanterns);
  let lastFlow: GameState['flow'] | null = null;
  return {
    flags,
    update(state) {
      const hf = renderer.terrain?.heightField;
      if (!hf) return;
      flow.visible = flags.flow;
      colliders.visible = flags.colliders;
      lanterns.visible = flags.lanterns;
      // grid: renderer.setGridVisible burada ÇAĞRILMAZ; game.frame `buildMode || debugGrid` ile çizimden önce karar verir.
      if (flags.flow && lastFlow !== state.flow) {
        lastFlow = state.flow;
        const pts: number[] = [];
        const f = state.flow.hearth;
        for (let c = 0; c < f.next.length; c++) {
          const n = f.next[c]!;
          if (n < 0) continue;
          const [i, j] = cellCoords(c);
          const [ni, nj] = cellCoords(n);
          const [x, z] = cellCenter(i, j);
          const [nx, nz] = cellCenter(ni, nj);
          const y = hf.heightAt(x, z) + D.arrowLift;
          const ex = x + (nx - x) * D.arrowShaft;
          const ez = z + (nz - z) * D.arrowShaft;
          pts.push(x, y, z, ex, hf.heightAt(ex, ez) + D.arrowLift, ez);
          // ok ucu
          const dx = (nx - x) * D.arrowHead;
          const dz = (nz - z) * D.arrowHead;
          pts.push(ex, y, ez, ex - dx - dz, y, ez - dz + dx, ex, y, ez, ex - dx + dz, y, ez - dz - dx);
        }
        setPoints(flow, pts);
      }
      if (flags.colliders) {
        const pts: number[] = [];
        for (const id of ids(state.players)) {
          const p = state.players[id]!;
          if (!p.dead)
            circle(pts, p.x, hf.heightAt(p.x, p.z) + D.groundLift, p.z, PLAYER.radius, D.playerSegments);
        }
        for (const id of ids(state.creatures)) {
          const c = state.creatures[id]!;
          circle(
            pts,
            c.x,
            hf.heightAt(c.x, c.z) + D.groundLift,
            c.z,
            CREATURES[c.kind].radius,
            D.creatureSegments,
          );
        }
        for (const id of ids(state.buildings))
          for (const c of state.buildings[id]!.cells) {
            const [i, j] = cellCoords(c);
            const [x, z] = cellCenter(i, j);
            const y = hf.heightAt(x, z) + D.groundLift;
            const h = D.cellHalf;
            pts.push(x - h, y, z - h, x + h, y, z - h, x + h, y, z - h, x + h, y, z + h);
            pts.push(x + h, y, z + h, x - h, y, z + h, x - h, y, z + h, x - h, y, z - h);
          }
        setPoints(colliders, pts);
      }
      if (flags.lanterns) {
        const pts: number[] = [];
        for (const id of ids(state.buildings)) {
          const b = state.buildings[id]!;
          if (b.kind !== 'lantern') continue;
          const { x, z } = buildingCenter(b);
          circle(
            pts,
            x,
            hf.heightAt(x, z) + D.groundLift,
            z,
            BUILDINGS.lantern.lightRadius as number,
            D.lanternSegments,
          );
        }
        setPoints(lanterns, pts);
      }
    },
  };
}
