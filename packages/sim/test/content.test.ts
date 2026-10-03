import { describe, expect, it } from 'vitest';
import { DT, SIM_TICK_HZ, secondsToTicks } from '../src/index';
import { BUILDINGS, HOTBAR, BLOCKED_CELL_COST, PROJECTILE_SPEED } from '../src/content/buildings';
import { CONTACT_MARGIN, CREATURES, SEPARATION } from '../src/content/creatures';
import { HEARTH_CELLS, HEARTH_SAFE_RADIUS, ISLAND_RADIUS, PLAZA_RADIUS } from '../src/content/island';
import { AXE, PLAYER } from '../src/content/player';
import { NODE_YIELD, RESOURCE_COUNTS, START_RESOURCES } from '../src/content/resources';
import { DAY_S, NIGHT_S } from '../src/content/time';
import { NIGHT1_WAVES, SPAWN_MIN_DIST_FROM_HEARTH, waveMultiplier } from '../src/content/waves';

describe('content (design notes sayıları)', () => {
  it('zaman', () => {
    expect(SIM_TICK_HZ).toBe(20);
    expect(DT).toBe(0.05);
    expect(secondsToTicks(90)).toBe(1800);
    expect(DAY_S).toBe(90);
    expect(NIGHT_S).toBe(75);
  });
  it('ada', () => {
    expect(ISLAND_RADIUS).toBe(22);
    expect(PLAZA_RADIUS).toBe(7);
    expect(HEARTH_SAFE_RADIUS).toBe(2.6);
    expect(HEARTH_CELLS).toEqual([
      [31, 31],
      [32, 31],
      [31, 32],
      [32, 32],
    ]);
  });
  it('oyuncu ve balta', () => {
    expect(PLAYER).toMatchObject({ speed: 4, radius: 0.35, maxHp: 100, respawnDelayS: 5 });
    expect(AXE).toEqual({ cooldownS: 0.5, arcDeg: 100, range: 1.3, creatureDamage: 12, cellReach: 0.5 });
  });
  it('kaynaklar', () => {
    expect(RESOURCE_COUNTS).toEqual({ tree: 14, rock: 8, bush: 7 });
    expect(NODE_YIELD.tree).toEqual({ hits: 4, wood: 3, stone: 0 });
    expect(NODE_YIELD.rock).toEqual({ hits: 4, wood: 0, stone: 2 });
    expect(START_RESOURCES).toEqual({ wood: 10, stone: 0 });
  });
  it('binalar', () => {
    expect(BUILDINGS.fence).toMatchObject({ name: 'Fence', cost: { wood: 5, stone: 0 }, hp: 60, size: 1 });
    expect(BUILDINGS.arrowTower).toMatchObject({
      name: 'Arrow Tower',
      cost: { wood: 12, stone: 6 },
      hp: 150,
      size: 2,
      range: 7,
      fireIntervalS: 1,
      damage: 10,
    });
    expect(BUILDINGS.lantern).toMatchObject({
      name: 'Lantern',
      cost: { wood: 4, stone: 2 },
      hp: 40,
      size: 1,
      lightRadius: 4,
      slowFactor: 0.4,
      shadelingDps: 3,
    });
    expect(BUILDINGS.hearth).toMatchObject({ name: 'The Hearth', hp: 500, size: 2 });
    expect(HOTBAR).toEqual(['fence', 'arrowTower', 'lantern']);
    expect(BLOCKED_CELL_COST).toBe(8);
    expect(PROJECTILE_SPEED).toBe(14);
  });
  it('yaratıklar', () => {
    expect(CREATURES.shadeling).toMatchObject({
      name: 'Shadeling',
      speed: 3.2,
      hp: 20,
      aggroRange: 6,
      contactDps: 8,
    });
    expect(SEPARATION).toEqual({ radius: 0.6, force: 2, maxPush: 0.15 });
    expect(CONTACT_MARGIN).toBe(0.05);
    expect(CREATURES.stumpkin).toMatchObject({
      name: 'Stumpkin',
      speed: 1.4,
      hp: 120,
      attackDamage: 20,
      attackIntervalS: 1.5,
    });
    expect(CREATURES.glowbug).toMatchObject({ name: 'Glowbug', speed: 2.6, hp: 15, contactDps: 10 });
  });
  it('dalgalar', () => {
    expect(NIGHT1_WAVES).toEqual([
      { atS: 0, shadeling: 6, stumpkin: 0, glowbug: 1 },
      { atS: 25, shadeling: 4, stumpkin: 1, glowbug: 1 },
      { atS: 50, shadeling: 6, stumpkin: 1, glowbug: 2 },
    ]);
    expect(waveMultiplier(1)).toBe(1);
    expect(waveMultiplier(3)).toBeCloseTo(1.7);
    expect(SPAWN_MIN_DIST_FROM_HEARTH).toBe(14);
  });
});
