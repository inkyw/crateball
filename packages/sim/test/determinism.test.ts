import { describe, expect, it } from 'vitest';
import { hashState } from '../src/hash';
import { createGame, ids } from '../src/state';
import { step } from '../src/step';
import type { PlayerInput, SimEvent } from '../src/types';

/**
 * 5 dakika (6000 tick) senaryolu oyun: yürü, vur, çit ve kule kur. Aynı seed + girdi → aynı hash.
 * Run'ın bitmemesi için kontrollü fixture: Hearth çok canlı ve oyuncu god (iki koşuda da aynı).
 */
function play(
  seed: number,
  ticks: number,
): { hash: string; events: SimEvent[]; state: ReturnType<typeof createGame>; midHash: string } {
  const s = createGame(seed);
  s.resources = { wood: 60, stone: 20 };
  s.buildings[s.hearthId]!.hp = 1e9;
  const pid = ids(s.players)[0]!;
  s.players[pid]!.god = true;
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
  ];
  const events: SimEvent[] = [];
  let midHash = '';
  for (let t = 0; t < ticks; t++) {
    const d = dirs[Math.floor(t / 40) % dirs.length]!;
    const input: PlayerInput = {
      playerId: pid,
      move: { x: d[0]!, z: d[1]! },
      aim: { x: s.players[pid]!.x + d[0]!, z: s.players[pid]!.z + d[1]! },
      attack: Math.floor(t / 100) % 2 === 0,
      place:
        t === 200
          ? {
              kind: 'fence',
              i: 30,
              j: 37,
              rot: 0,
              cells: [
                [30, 37],
                [34, 37],
              ],
            }
          : t === 300
            ? { kind: 'arrowTower', i: 27, j: 30, rot: 0 }
            : null,
    };
    events.push(...step(s, [input]).events);
    if (t === 2999) midHash = hashState(s);
  }
  return { hash: hashState(s), events, state: s, midHash };
}

describe('determinizm', () => {
  it('aynı seed + aynı girdi → aynı hash (6000 tick); farklı seed → farklı', () => {
    const t0 = Date.now();
    const a = play(7, 6000);
    const elapsed = Date.now() - t0;
    const b = play(7, 6000);
    expect(a.state.tick).toBe(6000); // run bitmedi: her tick sim çalıştı
    expect(a.state.over).toBe(false);
    expect(a.hash).toBe(b.hash);
    expect(hashState(a.events)).toBe(hashState(b.events)); // olay dizileri de birebir
    expect(a.events.length).toBeGreaterThan(50);
    expect(a.midHash).not.toBe(a.hash);
    expect(play(8, 600).hash).not.toBe(play(7, 600).hash);
    expect(elapsed).toBeLessThan(15_000);
    expect(a.state.day).toBeGreaterThanOrEqual(2);
    expect(a.events.some((e) => e.t === 'creatureSpawned')).toBe(true);
    expect(a.events.some((e) => e.t === 'built')).toBe(true);
    expect(a.events.some((e) => e.t === 'creatureDied')).toBe(true); // kule ve balta işledi
  }, 60_000);
});
