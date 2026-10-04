import { describe, expect, it } from 'vitest';
import { addPlayer, cloneGame, createGame } from '@crateball/sim';
import { createEventTracker } from '../src/events';

describe('olaylar', () => {
  it('başka oyuncunun ping kadar geç gelen vuruşu bir kez ses/efekt üretir', () => {
    const track = createEventTracker();
    const g = createGame(1);
    g.phase = 'play';
    const other = addPlayer(g, 'o', 'O', 'blue');
    g.tick = 100;
    track(g);
    const later = cloneGame(g);
    later.tick = 102;
    later.players[0]!.kickTick = 88; // 14 tick önce vurmuş, bize şimdi ulaştı
    expect(track(later).filter((e) => e.type === 'kick')).toHaveLength(1);
    const again = cloneGame(later);
    again.tick = 104;
    expect(track(again).filter((e) => e.type === 'kick')).toHaveLength(0);
    expect(other.id).toBe('o');
  });
  it('öldüren isabet de vurulma olayı üretir (son görülen konumda)', () => {
    const track = createEventTracker();
    const g = createGame(1);
    const p = addPlayer(g, 'v', 'V', 'red');
    p.x = 50;
    track(g);
    const dead = cloneGame(g);
    dead.tick++;
    Object.assign(dead.players[0]!, { hp: 0, dead: 180, x: 9999, y: 9999 });
    expect(track(dead)).toContainEqual({ type: 'hit', x: 50, y: p.y, team: 'red', killed: true });
  });
});
