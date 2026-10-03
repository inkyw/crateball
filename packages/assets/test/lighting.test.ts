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
  it('todFromPhase gündüzü 0.25–0.75, geceyi 0.75→0.25 arasına eşler', () => {
    expect(todFromPhase('day', 0)).toBeCloseTo(0.25);
    expect(todFromPhase('day', 1)).toBeCloseTo(0.75);
    expect(todFromPhase('night', 0)).toBeCloseTo(0.75);
    expect(todFromPhase('night', 0.5)).toBeCloseTo(0);
    expect(todFromPhase('night', 1)).toBeCloseTo(0.25);
  });
});
