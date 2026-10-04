import { describe, expect, it } from 'vitest';
import { TIME_KEYS, sampleKeys, todFromPhase } from '../src/lighting';

describe('lighting keys', () => {
  it('anahtarlar 0→1 artan', () => {
    for (let i = 1; i < TIME_KEYS.length; i++) expect(TIME_KEYS[i]!.t).toBeGreaterThan(TIME_KEYS[i - 1]!.t);
    expect(TIME_KEYS[0]!.t).toBe(0);
    expect(TIME_KEYS[TIME_KEYS.length - 1]!.t).toBe(1);
  });
  it('öğlen gündüz (night 0, gök 0x8FD0F2), gece yarısı night 1', () => {
    const noon = sampleKeys(0.5);
    expect(noon.night).toBe(0);
    expect(noon.sky.getHex()).toBe(0x8fd0f2);
    expect(sampleKeys(0).night).toBe(1);
    expect(sampleKeys(0.76).night).toBeGreaterThan(0.4);
  });
  it('todFromPhase gündüzü 0.32–0.75, geceyi 0.75→0.32 arasına eşler', () => {
    expect(todFromPhase('day', 0)).toBeCloseTo(0.32);
    expect(todFromPhase('day', 1)).toBeCloseTo(0.75);
    expect(todFromPhase('night', 0)).toBeCloseTo(0.75);
    expect(todFromPhase('night', 1)).toBeCloseTo(0.32);
  });
  it("gün başında gece oranı düşük: günün %5'inde night < 0.15, ilk tickte <= 0.1", () => {
    expect(sampleKeys(todFromPhase('day', 0)).night).toBeLessThanOrEqual(0.1);
    expect(sampleKeys(todFromPhase('day', 0.05)).night).toBeLessThan(0.15);
  });
  it('alacakaranlık/şafak faz sınırlarında görünür kalır, gece ortası karanlık', () => {
    expect(sampleKeys(todFromPhase('day', 1)).night).toBeGreaterThan(0.3);
    expect(sampleKeys(todFromPhase('night', 0.2)).night).toBeGreaterThan(0.9);
    expect(sampleKeys(todFromPhase('night', 0.9)).night).toBeGreaterThan(0.05);
    expect(sampleKeys(todFromPhase('night', 0.9)).night).toBeLessThan(0.9);
  });
});
