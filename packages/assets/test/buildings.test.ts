import { describe, expect, it } from 'vitest';
import { GLOW_MATERIAL } from '../src/geometry';
import {
  FENCE_VARIANTS,
  HEARTH_POOL,
  LANTERN_LAMP_OFFSET,
  LANTERN_POOL,
  makeArrow,
  makeFenceCell,
  makeHearth,
  makeLantern,
  makeTower,
} from '../src/models/buildings';

describe('fence variants', () => {
  it('16 maske varyantı; kollar maskeye göre uzar', () => {
    expect(FENCE_VARIANTS).toBe(16);
    const bboxX = (mask: number) => {
      const g = makeFenceCell(mask).opaque!;
      g.computeBoundingBox();
      return g.boundingBox!.max.x;
    };
    expect(bboxX(1)).toBeGreaterThan(0.5); // +x kolu
    expect(bboxX(2)).toBeLessThan(0.2); // sadece -x kolu
    expect(bboxX(0)).toBeGreaterThan(0.25); // tek başına: kısa kollar x ekseninde
    for (let m = 0; m < 16; m++) expect(makeFenceCell(m).triangles).toBeLessThanOrEqual(700);
  });
});

describe('tower, lantern, arrow', () => {
  it('kule tek opak geometri, bütçede', () => {
    const t = makeTower();
    expect(t.glow).toBeNull();
    expect(t.triangles).toBeLessThanOrEqual(3500);
    t.opaque!.computeBoundingBox();
    expect(t.opaque!.boundingBox!.max.y).toBeGreaterThan(4);
  });
  it('fener camı glow geometrisindedir; havuz tanımı var', () => {
    const l = makeLantern();
    expect(l.glow).not.toBeNull();
    expect(l.triangles).toBeLessThanOrEqual(1300);
    expect(LANTERN_LAMP_OFFSET).toEqual({ x: 0.42, z: 0 });
    expect(LANTERN_POOL).toEqual({ size: 4.2, color: 0xffb24d, base: 0.55 });
    expect(HEARTH_POOL).toEqual({ size: 8, color: 0xff8a3d, base: 0.75 });
  });
  it('ok küçük ve tek parça', () => {
    expect(makeArrow().triangles).toBeLessThanOrEqual(60);
  });
});

describe('hearth', () => {
  it('4 çizim nesnesi, ışık ve animasyon', () => {
    const h = makeHearth(null);
    // Çizim nesneleri: opak Mesh, köz glow Mesh, alev Mesh, Points (PointLight çizim değildir).
    expect(h.group.children.filter((c) => !('isLight' in c))).toHaveLength(4);
    expect(h.group.children).toContain(h.light);
    expect(
      h.group.children.filter((c) => (c as { material?: unknown }).material === GLOW_MATERIAL),
    ).toHaveLength(2);
    h.anim(0.5, 0.016, 0);
    const day = h.light.intensity;
    h.anim(1.0, 0.016, 1);
    expect(h.light.intensity).toBeGreaterThan(day);
    expect(() => h.anim(2, 0.05, 0.5)).not.toThrow();
    expect(() => h.dispose()).not.toThrow();
  });
});
