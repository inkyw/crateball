import { describe, expect, it } from 'vitest';
import { createRng } from '../src/rng';

describe('createRng', () => {
  it('aynı seed aynı diziyi verir (sabit referans değerler)', () => {
    const r = createRng(42);
    expect([r.next(), r.next(), r.next()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
  });
  it('state() ile kaldığı yerden devam eder', () => {
    const a = createRng(42);
    a.next();
    const b = createRng(a.state());
    expect(b.next()).toBe(a.next());
  });
  it('int aralığın içinde kalan tam sayı döner', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 9);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
    }
  });
  it('farklı seed farklı dizi verir', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
});
