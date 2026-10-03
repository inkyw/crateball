import { describe, expect, it } from 'vitest';
import { BUILDINGS, PROJECTILE_SPEED } from '../src/content/buildings';
import { CREATURES } from '../src/content/creatures';
import { addBuilding, buildingCenter, createGame, ids, spawnCreature } from '../src/state';
import { step } from '../src/step';
import type { SimEvent } from '../src/types';

describe('Arrow Tower', () => {
  it('menzildeki en yakın yaratığa saniyede bir ok; ok 14 u/s ile güdümlü uçar ve 10 hasar verir', () => {
    const s = createGame(1);
    const p = s.players[ids(s.players)[0]!]!;
    p.dead = true;
    p.respawnAtTick = 1e9;
    const tower = addBuilding(s, 'arrowTower', 33, 36, 0); // hücreler x 1..3, z 4..6 → merkez (2, 5)
    const center = buildingCenter(tower);
    const near = spawnCreature(s, 'stumpkin', center.x + 5, center.z);
    const far = spawnCreature(s, 'stumpkin', center.x + 6.5, center.z);
    spawnCreature(s, 'stumpkin', center.x + 9, center.z); // menzil dışı
    const ev1 = step(s, []).events;
    expect(ev1.filter((e) => e.t === 'arrowFired')).toHaveLength(1);
    expect(Object.keys(s.projectiles)).toHaveLength(1);
    const proj = s.projectiles[ids(s.projectiles)[0]!]!;
    expect(proj.targetId).toBe(near.id);
    expect(proj.damage).toBe(BUILDINGS.arrowTower.damage);
    const all: SimEvent[] = [];
    for (let k = 0; k < 19; k++) all.push(...step(s, []).events);
    expect(all.filter((e) => e.t === 'arrowFired')).toHaveLength(0); // 1 ok/sn
    expect(all.filter((e) => e.t === 'hit' && e.targetId === near.id)).toHaveLength(1);
    expect(near.hp).toBeLessThanOrEqual(CREATURES.stumpkin.hp - 10);
    expect(far.hp).toBe(CREATURES.stumpkin.hp);
    expect(step(s, []).events.filter((e) => e.t === 'arrowFired')).toHaveLength(1);
    expect(PROJECTILE_SPEED * 0.05).toBeCloseTo(0.7);
  });
  it('hedef ölürse ok sessizce silinir', () => {
    const s = createGame(1);
    const tower = addBuilding(s, 'arrowTower', 33, 36, 0);
    const center = buildingCenter(tower);
    const c = spawnCreature(s, 'shadeling', center.x + 6, center.z);
    const p = s.players[ids(s.players)[0]!]!;
    p.dead = true;
    p.respawnAtTick = 1e9;
    step(s, []);
    expect(Object.keys(s.projectiles)).toHaveLength(1);
    delete s.creatures[c.id];
    expect(() => step(s, [])).not.toThrow();
    expect(Object.keys(s.projectiles)).toHaveLength(0);
  });
});
