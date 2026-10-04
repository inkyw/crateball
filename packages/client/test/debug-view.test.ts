import { BufferGeometry, LineBasicMaterial, LineSegments } from 'three';
import { describe, expect, it } from 'vitest';
import { setPoints } from '../src/render/debug-view';

const make = () => new LineSegments(new BufferGeometry(), new LineBasicMaterial());
const pts = (n: number) => Array.from({ length: n * 3 }, (_, k) => k);

describe('debug-view setPoints', () => {
  it('aynı/küçük sayıda güncellemede aynı attribute ve dizi korunur, drawRange güncellenir', () => {
    const l = make();
    setPoints(l, pts(10));
    const a = l.geometry.getAttribute('position');
    const arr = a.array;
    setPoints(l, pts(10));
    setPoints(l, pts(4));
    expect(l.geometry.getAttribute('position')).toBe(a);
    expect(a.array).toBe(arr);
    expect(l.geometry.drawRange.count).toBe(4);
    expect(Array.from(a.array.slice(0, 3))).toEqual([0, 1, 2]);
  });
  it('kapasite aşılınca daha büyük yeni attribute oluşur ve eski geometri dispose edilir', () => {
    const l = make();
    setPoints(l, pts(10));
    const a = l.geometry.getAttribute('position');
    let disposed = 0;
    l.geometry.addEventListener('dispose', () => disposed++);
    setPoints(l, pts(5000));
    const b = l.geometry.getAttribute('position');
    expect(b).not.toBe(a);
    expect(b.array.length).toBeGreaterThanOrEqual(15000);
    expect(l.geometry.drawRange.count).toBe(5000);
    expect(disposed).toBe(1);
  });
});
