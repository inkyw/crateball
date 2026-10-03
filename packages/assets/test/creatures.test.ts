import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  SPAWN_GROW_S,
  creatureInstanceMatrix,
  creatureScale,
  makeGlowbug,
  makeShadeling,
  makeStumpkin,
} from '../src/models/creatures';

describe('creature models', () => {
  it('her yaratık opak + glow geometrisi üretir ve bütçede kalır (200 instance × 3 geçiş)', () => {
    for (const [b, max] of [
      [makeShadeling(1), 550],
      [makeStumpkin(2), 1300],
      [makeGlowbug(3), 1000],
    ] as const) {
      expect(b.opaque).not.toBeNull();
      expect(b.glow).not.toBeNull();
      expect(b.triangles).toBeLessThanOrEqual(max);
    }
  });
  it('creatureScale deterministik ve 0.9–1.15 arası (Shadeling), diğerleri 1', () => {
    expect(creatureScale('shadeling', 5)).toBe(creatureScale('shadeling', 5));
    expect(creatureScale('shadeling', 5)).toBeGreaterThanOrEqual(0.9);
    expect(creatureScale('shadeling', 5)).toBeLessThanOrEqual(1.15);
    expect(creatureScale('stumpkin', 5)).toBe(1);
  });
  it('instance matrisi: Shadeling zıplar, Glowbug süzülür, doğarken büyür', () => {
    const m = new Matrix4();
    const p = new Vector3();
    const ys = [0, 0.15, 0.3, 0.45].map(
      (t) => p.setFromMatrixPosition(creatureInstanceMatrix('shadeling', 1, 0.5, 2, 0, t, 1, 10, m)).y,
    );
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.1);
    expect(ys.every((y) => y >= 0.5)).toBe(true);
    p.setFromMatrixPosition(creatureInstanceMatrix('glowbug', 0, 0, 0, 0, 0, 1, 10, m));
    expect(p.y).toBeGreaterThan(0.7);
    const s = new Vector3();
    s.setFromMatrixScale(creatureInstanceMatrix('stumpkin', 0, 0, 0, 0, 0, 1, SPAWN_GROW_S / 2, m));
    expect(s.x).toBeCloseTo(0.5, 5);
    s.setFromMatrixScale(creatureInstanceMatrix('stumpkin', 0, 0, 0, 0, 0, 1, 5, m));
    expect(s.x).toBe(1);
  });
});
