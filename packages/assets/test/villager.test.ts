import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { GLOW_MATERIAL, SHARED_MATERIAL } from '../src/geometry';
import { makeVillager } from '../src/models/villager';
import { PAL } from '../src/palette';

const meshes = (g: { traverse: (f: (o: unknown) => void) => void }) => {
  const out: Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
};

describe('makeVillager', () => {
  it('7 çizim nesnesi: tek paylaşılan malzeme + kafa glow', () => {
    const v = makeVillager({ color: PAL.p1, hat: 'beanie', seed: 1 });
    const ms = meshes(v.group);
    expect(ms).toHaveLength(7);
    expect(ms.filter((m) => m.material === SHARED_MATERIAL)).toHaveLength(6);
    expect(ms.filter((m) => m.material === GLOW_MATERIAL)).toHaveLength(1);
    for (const hat of ['beanie2', 'straw', 'bandana'] as const)
      expect(meshes(makeVillager({ hat }).group)).toHaveLength(7);
  });
  it('yürüme bacakları, vuruş kolu oynatır; idle sakin', () => {
    const v = makeVillager({});
    v.setState('walk');
    v.anim(0.1, 0);
    const legs = v.group.getObjectByName('legL')!;
    const arm = v.group.getObjectByName('armR')!;
    expect(Math.abs(legs.rotation.x)).toBeGreaterThan(0.1);
    v.setState('chop');
    v.anim(0, 0.3);
    expect(arm.rotation.x).toBeLessThan(-1);
    v.setState('idle');
    v.anim(0, 0);
    expect(legs.rotation.x).toBe(0);
  });
});
