import { describe, expect, it } from 'vitest';
import { fbm, hash2, lerp, smoothstep, vnoise } from '../src/noise';

describe('noise', () => {
  it('smoothstep ve lerp', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(lerp(2, 4, 0.25)).toBe(2.5);
  });
  it('hash2 deterministik ve [0,1) aralığında', () => {
    expect(hash2(3, 7, 1)).toBe(hash2(3, 7, 1));
    expect(hash2(3, 7, 1)).not.toBe(hash2(3, 7, 2));
    for (let i = 0; i < 200; i++) {
      const v = hash2(i, i * 3, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('vnoise tam sayı noktalarda hash2 ile aynıdır ve süreklidir', () => {
    expect(vnoise(4, 9, 2)).toBeCloseTo(hash2(4, 9, 2), 12);
    expect(Math.abs(vnoise(4.001, 9.002, 2) - vnoise(4, 9, 2))).toBeLessThan(0.01);
  });
  it('kit formülünün sabit referans değerleri (assets kopyası aynı değerleri doğrular)', () => {
    // prototypes/asset-kit/index.html içindeki hash2/vnoise/fbm ile Node'da hesaplandı.
    expect(hash2(3, 7, 1)).toBe(0.854412094457075);
    expect(hash2(0, 0, 0)).toBe(0);
    expect(vnoise(1.5, 2.5, 1)).toBe(0.43120211153291166);
    expect(fbm(1.37, -2.1, 1, 4)).toBe(0.315635725321725);
    expect(fbm(1.37, -2.1, 7, 3)).toBe(0.40889752186382783);
  });
});
