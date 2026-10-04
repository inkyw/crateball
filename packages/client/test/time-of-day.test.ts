import { describe, expect, it } from 'vitest';
import { sampleKeys } from '@gg/assets';
import { createGame } from '@gg/sim';
import { timeOfDay } from '../src/render/time-of-day';

describe('timeOfDay', () => {
  it('gün başı 0.32, gün ortası 0.535, gece başı 0.75, gece sonu 0.32', () => {
    const s = createGame(1);
    expect(timeOfDay(s, 0)).toBeCloseTo(0.32);
    s.tick = 900;
    expect(timeOfDay(s, 0)).toBeCloseTo(0.535);
    s.tick = 899;
    expect(timeOfDay(s, 1)).toBeCloseTo(0.535);
    s.phase = 'night';
    s.phaseStartTick = 1800;
    s.phaseEndTick = 3300;
    s.tick = 1800;
    expect(timeOfDay(s, 0)).toBeCloseTo(0.75);
    s.tick = 3300;
    expect(timeOfDay(s, 0)).toBeCloseTo(0.32);
  });
  it('1. günün ilk tickinde ve %5 sonrasında gece oranı düşük (gün karanlık başlamaz)', () => {
    const s = createGame(1);
    expect(sampleKeys(timeOfDay(s, 0)).night).toBeLessThanOrEqual(0.1);
    s.tick = s.phaseStartTick + Math.round((s.phaseEndTick - s.phaseStartTick) * 0.05);
    expect(sampleKeys(timeOfDay(s, 0)).night).toBeLessThan(0.15);
  });
});
