import { createGlowPool } from '@gg/assets';
import { createGame } from '@gg/sim';
import { InstancedMesh, Matrix4, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { RENDER } from '../src/render/config';
import { createEntityViews } from '../src/render/entity-views';

describe('entity views capacity', () => {
  it('keeps every instance when creature count exceeds initial capacity', () => {
    const s = createGame(1);
    const n = RENDER.maxCreatures + 1;
    for (let id = 1000; id < 1000 + n; id++) {
      s.creatures[id] = { id, kind: 'glowbug', x: id - 1000, z: 2, yaw: 0, bornTick: 0 } as never;
    }
    const scene = new Scene();
    const glow = createGlowPool(4, null);
    const hf = { heightAt: () => 0.5 } as never;
    const views = createEntityViews(scene, hf, glow);
    views.update(s, { creatures: {}, players: {}, projectiles: {} } as never, 0, 0, 1);
    const meshes = scene.children.filter(
      (o): o is InstancedMesh => o instanceof InstancedMesh && o.count === n,
    );
    expect(meshes.length).toBeGreaterThan(0);
    const m = new Matrix4();
    for (const mesh of meshes) {
      for (let i = 0; i < n; i++) {
        mesh.getMatrixAt(i, m);
        expect(m.elements[12]).toBeCloseTo(i, 3); // creature i's x, not identity
      }
    }
    expect(glow.mesh.count).toBe(n + 1);
    const c = glow.mesh.instanceColor!;
    for (let i = 0; i < n + 1; i++) expect(c.getX(i) + c.getY(i) + c.getZ(i)).toBeGreaterThan(0);
    views.dispose();
    glow.dispose();
  });
});
