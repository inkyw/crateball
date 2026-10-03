import { BoxGeometry, Color, Group, Matrix4, SphereGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  GLOW_MATERIAL,
  SHARED_MATERIAL,
  bake,
  bakedToGroup,
  composeMatrix,
  createInstanced,
  part,
  setGlowLevel,
  smoothBlob,
} from '../src/geometry';
import { fbm, hash2, noise3, rng, vnoise } from '../src/noise';
import { PAL } from '../src/palette';

describe('bake', () => {
  it('opak parçaları tek geometriye birleştirir, rengi köşe rengine yazar', () => {
    const b = bake([
      part(new BoxGeometry(1, 1, 1), PAL.wood),
      part(new BoxGeometry(1, 1, 1), PAL.roof, { at: [2, 0, 0] }),
    ]);
    expect(b.glow).toBeNull();
    expect(b.opaque).not.toBeNull();
    const g = b.opaque!;
    expect(g.index).toBeNull();
    expect(g.getAttribute('uv')).toBeUndefined();
    expect(g.getAttribute('color').itemSize).toBe(3);
    expect(g.getAttribute('position').count).toBe(72); // 2 kutu × 12 üçgen × 3
    expect(b.triangles).toBe(24);
    const c = new Color(PAL.wood);
    expect(g.getAttribute('color').getX(0)).toBeCloseTo(c.r, 5);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x).toBeCloseTo(2.5, 5);
  });
  it('glow parçaları ayrı geometriye gider ve yoğunlukla çarpılır', () => {
    const b = bake([
      part(new BoxGeometry(1, 1, 1), PAL.wood),
      part(new SphereGeometry(0.1, 6, 4), PAL.eyeGlow, { glow: true, intensity: 3 }),
    ]);
    expect(b.opaque).not.toBeNull();
    expect(b.glow).not.toBeNull();
    const c = new Color(PAL.eyeGlow);
    expect(b.glow!.getAttribute('color').getX(0)).toBeCloseTo(c.r * 3, 4);
  });
  it('flat parça yüz başına normal taşır (toNonIndexed)', () => {
    const b = bake([part(new SphereGeometry(0.5, 8, 6), PAL.leaf, { flat: true })]);
    const n = b.opaque!.getAttribute('normal');
    // Bir üçgenin üç köşesinin normali aynıdır.
    expect(n.getX(0)).toBeCloseTo(n.getX(1), 6);
    expect(n.getY(0)).toBeCloseTo(n.getY(2), 6);
  });
  it('part dönüşümü (rot, scale) uygulanır', () => {
    const p = part(new BoxGeometry(2, 1, 1), PAL.wood, { rot: [0, Math.PI / 2, 0], scale: 2 });
    p.geometry.computeBoundingBox();
    expect(p.geometry.boundingBox!.max.z).toBeCloseTo(2, 5);
    expect(p.geometry.boundingBox!.max.x).toBeCloseTo(1, 5);
  });
  it('colorOf yüz başına renk verir', () => {
    const b = bake([
      part(new BoxGeometry(1, 1, 1), PAL.rock, { colorOf: (_f, ny) => (ny > 0.5 ? PAL.moss : PAL.rockDark) }),
    ]);
    const col = b.opaque!.getAttribute('color');
    const pos = b.opaque!.getAttribute('position');
    const moss = new Color(PAL.moss);
    const dark = new Color(PAL.rockDark);
    for (let v = 0; v < pos.count; v++) {
      const f = v - (v % 3);
      const top = pos.getY(f) > 0.49 && pos.getY(f + 1) > 0.49 && pos.getY(f + 2) > 0.49;
      expect(col.getX(v)).toBeCloseTo(top ? moss.r : dark.r, 5);
    }
  });
  it('smoothBlob deterministiktir', () => {
    const a = smoothBlob(0.4, 2, 0.05, 3).getAttribute('position');
    const b = smoothBlob(0.4, 2, 0.05, 3).getAttribute('position');
    expect(a.count).toBe(b.count);
    expect(a.getX(5)).toBe(b.getX(5));
    expect(a.getX(5)).not.toBe(smoothBlob(0.4, 2, 0.05, 4).getAttribute('position').getX(5));
  });
});

describe('instancing ve malzemeler', () => {
  it('createInstanced iki InstancedMesh üretir ve sayıyı ayarlar', () => {
    const b = bake([part(new BoxGeometry(), PAL.wood), part(new BoxGeometry(), PAL.ember, { glow: true })]);
    const m = createInstanced(b, 50);
    expect(m.opaque!.material).toBe(SHARED_MATERIAL);
    expect(m.glow!.material).toBe(GLOW_MATERIAL);
    m.setMatrixAt(3, composeMatrix(1, 2, 3, 0.5, 1, new Matrix4()));
    m.setCount(4);
    expect(m.opaque!.count).toBe(4);
    expect(m.glow!.count).toBe(4);
    const v = new Vector3();
    m.opaque!.getMatrixAt(3, new Matrix4().copy(new Matrix4()));
    const mat = new Matrix4();
    m.opaque!.getMatrixAt(3, mat);
    v.setFromMatrixPosition(mat);
    expect([v.x, v.y, v.z]).toEqual([1, 2, 3]);
  });
  it("ensureCapacity buffer'ı büyütür, sahnedeki nesneyi değiştirir, eskisini bırakır", () => {
    const b = bake([part(new BoxGeometry(), PAL.wood), part(new BoxGeometry(), PAL.ember, { glow: true })]);
    const m = createInstanced(b, 2);
    const parent = new Group();
    parent.add(...m.objects);
    const old = m.opaque!;
    m.ensureCapacity(10);
    expect(m.capacity).toBe(16);
    expect(m.opaque).not.toBe(old);
    expect(old.parent).toBeNull();
    expect(parent.children).toHaveLength(2);
    expect(parent.children).toContain(m.opaque);
    expect(m.opaque!.instanceMatrix.count).toBe(16);
    m.setMatrixAt(9, composeMatrix(0, 0, 0, 0, 1, new Matrix4()));
    m.setCount(10);
    expect(m.glow!.count).toBe(10);
    m.dispose();
    expect(parent.children).toHaveLength(0);
  });
  it('bakedToGroup gölge bayraklarını ayarlar', () => {
    const g = bakedToGroup(bake([part(new BoxGeometry(), PAL.wood)]), { castShadow: false });
    expect(g.children).toHaveLength(1);
    expect((g.children[0] as { castShadow: boolean }).castShadow).toBe(false);
  });
  it('setGlowLevel gece parlaklığını ölçekler', () => {
    setGlowLevel(0);
    expect(GLOW_MATERIAL.color.r).toBeCloseTo(0.4, 5);
    setGlowLevel(1);
    expect(GLOW_MATERIAL.color.r).toBe(1);
  });
});

describe('noise', () => {
  it('rng deterministik; gürültü sim kopyasıyla aynı referans değerleri verir', () => {
    const a = rng(5);
    const b = rng(5);
    expect(a()).toBe(b());
    expect(hash2(3, 7, 1)).toBe(0.854412094457075);
    expect(vnoise(1.5, 2.5, 1)).toBe(0.43120211153291166);
    expect(fbm(1.37, -2.1, 1, 4)).toBe(0.315635725321725);
    expect(noise3(0.3, 0.6, 0.9, 2)).toBe(0.7691141198643174);
  });
});
