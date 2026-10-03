import { describe, expect, it } from 'vitest';
import { createGame, ids, spawnCreature } from '../src/state';
import { step } from '../src/step';
import type { SimEvent } from '../src/types';

const run = (s: ReturnType<typeof createGame>, n: number) => {
  const all: SimEvent[] = [];
  for (let k = 0; k < n; k++) all.push(...step(s, []).events);
  return all;
};

describe('gün/gece', () => {
  it('90 sn sonra gece 1, 75 sn sonra gün 2; şafakta yaratıklar dağılır', () => {
    const s = createGame(1);
    // Kontrollü fixture: Task 14'te tam hat gerçek dalgalar doğurur; Hearth ve oyuncu şafağa kadar yaşamalı.
    s.buildings[s.hearthId]!.hp = 1e9;
    s.players[ids(s.players)[0]!]!.god = true;
    const ev = run(s, 1800);
    expect(s.phase).toBe('night');
    expect(s.night).toBe(1);
    expect(s.phaseStartTick).toBe(1800);
    expect(s.phaseEndTick).toBe(3300);
    expect(ev.filter((e) => e.t === 'phaseChanged')).toEqual([
      { t: 'phaseChanged', phase: 'night', day: 1, night: 1 },
    ]);
    spawnCreature(s, 'shadeling', 10, 10);
    s.projectiles[999] = { id: 999, x: 5, z: 5, targetId: 0, damage: 10 };
    const ev2 = run(s, 1500);
    expect(s.phase).toBe('day');
    expect(s.day).toBe(2);
    expect(s.night).toBe(1);
    expect(Object.keys(s.creatures)).toHaveLength(0);
    expect(Object.keys(s.projectiles)).toHaveLength(0);
    expect(ev2.filter((e) => e.t === 'phaseChanged')).toEqual([
      { t: 'phaseChanged', phase: 'day', day: 2, night: 1 },
    ]);
  });
  it('over ise step hiçbir şey yapmaz', () => {
    const s = createGame(1);
    s.over = true;
    const { events } = step(s, []);
    expect(events).toEqual([]);
    expect(s.tick).toBe(0);
  });
});
