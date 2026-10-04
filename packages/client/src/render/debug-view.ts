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
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from 'three';
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

function circle(out: number[], x: number, y: number, z: number, r: number, seg = 16): void {
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2;
    const a1 = ((k + 1) / seg) * Math.PI * 2;
    out.push(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, y, z + Math.sin(a1) * r);
  }
}
function lines(color: number): LineSegments {
  const l = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false }),
  );
  l.renderOrder = 20;
  l.frustumCulled = false;
  l.visible = false;
  return l;
}
function setPoints(l: LineSegments, pts: number[]): void {
  l.geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
  l.geometry.computeBoundingSphere();
}

/** F1 paneli anahtarları: flow okları (Hearth alanı), çarpıştırıcılar, fener yarıçapları; ızgara renderer'dan. */
export function createDebugView(renderer: GameRenderer): DebugView {
  const flags: DebugFlags = { flow: false, colliders: false, grid: false, lanterns: false };
  const flow = lines(0x8ff3ff);
  const colliders = lines(0xffd75e);
  const lanterns = lines(0xffb24d);
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
          const y = hf.heightAt(x, z) + 0.12;
          const ex = x + (nx - x) * 0.7;
          const ez = z + (nz - z) * 0.7;
          pts.push(x, y, z, ex, hf.heightAt(ex, ez) + 0.12, ez);
          // ok ucu
          const dx = (nx - x) * 0.15;
          const dz = (nz - z) * 0.15;
          pts.push(ex, y, ez, ex - dx - dz, y, ez - dz + dx, ex, y, ez, ex - dx + dz, y, ez - dz - dx);
        }
        setPoints(flow, pts);
      }
      if (flags.colliders) {
        const pts: number[] = [];
        for (const id of ids(state.players)) {
          const p = state.players[id]!;
          if (!p.dead) circle(pts, p.x, hf.heightAt(p.x, p.z) + 0.1, p.z, PLAYER.radius);
        }
        for (const id of ids(state.creatures)) {
          const c = state.creatures[id]!;
          circle(pts, c.x, hf.heightAt(c.x, c.z) + 0.1, c.z, CREATURES[c.kind].radius, 10);
        }
        for (const id of ids(state.buildings))
          for (const c of state.buildings[id]!.cells) {
            const [i, j] = cellCoords(c);
            const [x, z] = cellCenter(i, j);
            const y = hf.heightAt(x, z) + 0.1;
            pts.push(x - 0.5, y, z - 0.5, x + 0.5, y, z - 0.5, x + 0.5, y, z - 0.5, x + 0.5, y, z + 0.5);
            pts.push(x + 0.5, y, z + 0.5, x - 0.5, y, z + 0.5, x - 0.5, y, z + 0.5, x - 0.5, y, z - 0.5);
          }
        setPoints(colliders, pts);
      }
      if (flags.lanterns) {
        const pts: number[] = [];
        for (const id of ids(state.buildings)) {
          const b = state.buildings[id]!;
          if (b.kind !== 'lantern') continue;
          const { x, z } = buildingCenter(b);
          circle(pts, x, hf.heightAt(x, z) + 0.1, z, BUILDINGS.lantern.lightRadius as number, 32);
        }
        setPoints(lanterns, pts);
      }
    },
  };
}
