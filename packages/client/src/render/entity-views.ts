import {
  type Baked,
  FENCE_VARIANTS,
  GLOWBUG_POOL,
  type GlowPool,
  HEARTH_POOL,
  type HeightField,
  type InstancedModel,
  LANTERN_LAMP_OFFSET,
  LANTERN_POOL,
  composeMatrix,
  createInstanced,
  creatureInstanceMatrix,
  hash2,
  makeArrow,
  makeBush,
  makeFenceCell,
  makeGlowbug,
  makeLantern,
  makeOak,
  makePine,
  makeRock,
  makeShadeling,
  makeStumpkin,
  makeTower,
} from '@gg/assets';
import {
  type CreatureKind,
  DIRS,
  type GameState,
  HEARTH_POS,
  type PoseSnapshot,
  buildingCenter,
  cellCenter,
  cidx,
  ids,
  inGrid,
} from '@gg/sim';
import { Matrix4, type Scene } from 'three';
import { RENDER } from './config';

export interface EntityViews {
  update(state: GameState, prev: PoseSnapshot, alpha: number, tS: number, night: number): void;
  /** Sahip olunan geometriler ve instance buffer'ları bırakılır (paylaşılan malzemeler kalır). */
  dispose(): void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** easeOutBack (kit): kaynak büyüme. */
const easeOutBack = (k: number) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);

export function createEntityViews(scene: Scene, hf: HeightField, glowPool: GlowPool): EntityViews {
  const mk = (b: Baked, max: number, castShadow = true) => {
    const im = createInstanced(b, max, { castShadow });
    scene.add(...im.objects);
    return im;
  };
  const pine = mk(makePine(3, 1), RENDER.maxNodes);
  const oak = mk(makeOak(5, 1), RENDER.maxNodes);
  const rock = mk(makeRock(4, 0.7), RENDER.maxNodes);
  const bush = mk(makeBush(2), RENDER.maxNodes);
  const creatures: Record<CreatureKind, InstancedModel> = {
    shadeling: mk(makeShadeling(1), RENDER.maxCreatures, RENDER.creatureShadows),
    stumpkin: mk(makeStumpkin(2), RENDER.maxCreatures, RENDER.creatureShadows),
    glowbug: mk(makeGlowbug(3), RENDER.maxCreatures, RENDER.creatureShadows),
  };
  const fences: InstancedModel[] = [];
  for (let mask = 0; mask < FENCE_VARIANTS; mask++) fences.push(mk(makeFenceCell(mask), RENDER.maxFences));
  const tower = mk(makeTower(), RENDER.maxBuildings);
  const lantern = mk(makeLantern(), RENDER.maxBuildings);
  const arrow = mk(makeArrow(), RENDER.maxProjectiles, false);
  const m = new Matrix4();
  const all = [pine, oak, rock, bush, ...Object.values(creatures), ...fences, tower, lantern, arrow];

  const fenceMask = (state: GameState, i: number, j: number): number => {
    let mask = 0;
    DIRS.forEach(([dx, dz], b) => {
      if (!inGrid(i + dx, j + dz)) return;
      const id = state.occ[cidx(i + dx, j + dz)] ?? 0;
      if (id && state.buildings[id]?.kind === 'fence') mask |= 1 << b;
    });
    return mask;
  };

  return {
    update(state, prev, alpha, tS, night) {
      let glow = 0;
      const counts = new Map<InstancedModel, number>();
      // Kapasite sim sözleşmesinde yok: gerekirse buffer büyür (sessiz sınır yok).
      const put = (im: InstancedModel, mat: Matrix4) => {
        const n = counts.get(im) ?? 0;
        im.ensureCapacity(n + 1);
        im.setMatrixAt(n, mat);
        counts.set(im, n + 1);
      };
      const pool = (x: number, y: number, z: number, size: number, color: number, base: number) => {
        glowPool.ensureCapacity(glow + 1);
        glowPool.set(glow++, x, y, z, size, color, base);
      };
      // kaynaklar
      for (const id of ids(state.nodes)) {
        const n = state.nodes[id]!;
        const [x, z] = cellCenter(n.i, n.j);
        const age = (state.tick + alpha - n.bornTick) / 20;
        const grow = n.bornTick === 0 ? 1 : Math.max(0.001, easeOutBack(Math.min(1, age / RENDER.nodeGrowS)));
        const yaw = hash2(id, 1, 5) * Math.PI * 2;
        const scale = (n.kind === 'rock' ? 0.8 + hash2(id, 2, 5) * 0.35 : 0.9 + hash2(id, 2, 5) * 0.3) * grow;
        const im = n.kind === 'tree' ? (id % 2 === 0 ? pine : oak) : n.kind === 'rock' ? rock : bush;
        put(im, composeMatrix(x, hf.heightAt(x, z), z, yaw, scale, m));
      }
      // yaratıklar + Glowbug haleleri
      const hearthY = hf.heightAt(HEARTH_POS.x, HEARTH_POS.z);
      pool(HEARTH_POS.x, hearthY + 0.02, HEARTH_POS.z, HEARTH_POOL.size, HEARTH_POOL.color, HEARTH_POOL.base);
      for (const id of ids(state.creatures)) {
        const c = state.creatures[id]!;
        const p = prev.creatures[id];
        const x = p ? lerp(p.x, c.x, alpha) : c.x;
        const z = p ? lerp(p.z, c.z, alpha) : c.z;
        const ageS = (state.tick + alpha - c.bornTick) / 20;
        put(
          creatures[c.kind],
          creatureInstanceMatrix(c.kind, x, hf.heightAt(x, z), z, c.yaw, tS, id, ageS, m),
        );
        if (c.kind === 'glowbug')
          pool(x, hf.heightAt(x, z) + 0.03, z, GLOWBUG_POOL.size, GLOWBUG_POOL.color, GLOWBUG_POOL.base);
      }
      // binalar
      for (const id of ids(state.buildings)) {
        const b = state.buildings[id]!;
        if (b.kind === 'hearth') continue;
        const { x, z } = buildingCenter(b);
        const y = hf.heightAt(x, z);
        const yaw = (b.rot * Math.PI) / 2;
        if (b.kind === 'fence') {
          const mask = fenceMask(state, b.i, b.j);
          put(fences[mask]!, composeMatrix(x, y, z, mask === 0 && b.rot % 2 === 1 ? Math.PI / 2 : 0, 1, m));
        } else if (b.kind === 'arrowTower') put(tower, composeMatrix(x, y, z, yaw, 1, m));
        else {
          put(lantern, composeMatrix(x, y, z, yaw, 1, m));
          const lx = x + Math.cos(yaw) * LANTERN_LAMP_OFFSET.x + Math.sin(yaw) * LANTERN_LAMP_OFFSET.z;
          const lz = z - Math.sin(yaw) * LANTERN_LAMP_OFFSET.x + Math.cos(yaw) * LANTERN_LAMP_OFFSET.z;
          pool(lx, y + 0.03, lz, LANTERN_POOL.size, LANTERN_POOL.color, LANTERN_POOL.base);
        }
      }
      // oklar
      for (const id of ids(state.projectiles)) {
        const pr = state.projectiles[id]!;
        const p = prev.projectiles[id];
        const x = p ? lerp(p.x, pr.x, alpha) : pr.x;
        const z = p ? lerp(p.z, pr.z, alpha) : pr.z;
        const t = state.creatures[pr.targetId];
        const yaw = t ? Math.atan2(t.x - x, t.z - z) : 0;
        put(arrow, composeMatrix(x, hf.heightAt(x, z) + RENDER.arrowHeight, z, yaw, 1, m));
      }
      for (const im of all) {
        im.setCount(counts.get(im) ?? 0);
        im.commit();
      }
      glowPool.setCount(glow);
      glowPool.setNight(night);
    },
    dispose() {
      for (const im of all) im.dispose();
    },
  };
}
