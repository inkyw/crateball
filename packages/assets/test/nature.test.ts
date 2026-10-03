import { describe, expect, it } from 'vitest';
import {
  makeBush,
  makeFlower,
  makeGrassTuft,
  makeOak,
  makePebble,
  makePine,
  makeRock,
} from '../src/models/nature';

describe('nature models', () => {
  it('her model opak geometri üretir ve üçgen bütçesinde kalır', () => {
    expect(makePine(3, 1).triangles).toBeLessThanOrEqual(400);
    expect(makeOak(5, 1).triangles).toBeLessThanOrEqual(900);
    expect(makeBush(2).triangles).toBeLessThanOrEqual(800);
    expect(makeRock(4, 0.8).triangles).toBeLessThanOrEqual(400);
    expect(makeGrassTuft().triangles).toBeLessThanOrEqual(40);
    expect(makeFlower().triangles).toBeLessThanOrEqual(20);
    expect(makePebble().triangles).toBeLessThanOrEqual(20);
    for (const b of [makePine(1), makeOak(1), makeBush(1), makeRock(1)]) {
      expect(b.opaque).not.toBeNull();
      expect(b.glow).toBeNull();
      expect(b.triangles).toBeGreaterThan(0);
    }
  });
  it('ağaç yüksekliği ölçekle büyür ve deterministiktir', () => {
    const a = makePine(3, 1).opaque!;
    const b = makePine(3, 1.3).opaque!;
    a.computeBoundingBox();
    b.computeBoundingBox();
    expect(b.boundingBox!.max.y).toBeGreaterThan(a.boundingBox!.max.y * 1.2);
    expect(a.boundingBox!.max.y).toBeGreaterThan(2.5);
    expect(makePine(3, 1).opaque!.getAttribute('position').getX(10)).toBe(
      a.getAttribute('position').getX(10),
    );
  });
  it('kaya yosun ve kaya renklerini yüz bazlı taşır', () => {
    const col = makeRock(4, 0.8).opaque!.getAttribute('color');
    const greens = new Set<number>();
    for (let i = 0; i < col.count; i++) greens.add(Math.round(col.getY(i) * 100));
    expect(greens.size).toBeGreaterThan(1);
  });
});
