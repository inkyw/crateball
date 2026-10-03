import { describe, expect, it } from 'vitest';
import { createGame } from '@gg/sim';
import { timeOfDay } from '../src/render/time-of-day';

describe('timeOfDay', () => {
  it('gün başı 0.25, gün ortası 0.5, gece yarısı 0', () => {
    const s = createGame(1);
    expect(timeOfDay(s, 0)).toBeCloseTo(0.25);
    s.tick = 900;
    expect(timeOfDay(s, 0)).toBeCloseTo(0.5);
    s.tick = 899;
    expect(timeOfDay(s, 1)).toBeCloseTo(0.5);
    s.phase = 'night';
    s.phaseStartTick = 1800;
    s.phaseEndTick = 3300;
    s.tick = 2550;
    expect(timeOfDay(s, 0)).toBeCloseTo(0);
    s.tick = 1800;
    expect(timeOfDay(s, 0)).toBeCloseTo(0.75);
  });
});
