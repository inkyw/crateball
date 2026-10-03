// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { GameState } from '@gg/sim';
import { createHud } from '../src/hud';

function fakeState(over: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    tick: 600,
    nextId: 3,
    rng: 1,
    phase: 'day',
    day: 1,
    night: 0,
    phaseStartTick: 0,
    phaseEndTick: 1800,
    over: false,
    island: { size: 64, level: [], ramp: [], dWater: [], dLand: [] },
    occ: [],
    resources: { wood: 7, stone: 2 },
    players: {
      2: {
        id: 2,
        x: 0,
        z: 3.5,
        yaw: 0,
        hp: 60,
        dead: false,
        respawnAtTick: 0,
        axeReadyTick: 0,
        swingTick: 0,
        god: false,
      },
    },
    nodes: {},
    buildings: { 1: { id: 1, kind: 'hearth', i: 31, j: 31, rot: 0, hp: 250, cells: [], nextShotTick: 0 } },
    creatures: {},
    projectiles: {},
    hearthId: 1,
    pendingRespawns: [],
    wavesSpawned: 0,
    flow: {
      hearth: { dist: [], next: [] },
      buildings: { dist: [], next: [] },
      lanterns: { dist: [], next: [] },
    },
    flowDirty: false,
    ...over,
  };
}

describe('createHud', () => {
  it('kaynak, faz, kalan süre ve can çubuklarını yazar', () => {
    const hud = createHud(document.body);
    hud.update(fakeState(), 2);
    expect(document.querySelector('#res-wood')!.textContent).toBe('7');
    expect(document.querySelector('#res-stone')!.textContent).toBe('2');
    expect(document.querySelector('#phase-label')!.textContent).toBe('Day 1');
    expect(document.querySelector('#phase-time')!.textContent).toBe('1:00'); // (1800-600)/20 = 60 s
    expect((document.querySelector('#phase-fill') as HTMLElement).style.width).toBe('66.7%');
    expect((document.querySelector('#hearth-hp') as HTMLElement).style.width).toBe('50%');
    expect((document.querySelector('#player-hp') as HTMLElement).style.width).toBe('60%');
    hud.update(
      fakeState({ phase: 'night', night: 1, phaseStartTick: 1800, phaseEndTick: 3300, tick: 1800 }),
      2,
    );
    expect(document.querySelector('#phase-label')!.textContent).toBe('Night 1');
    expect(document.querySelector('#phase-time')!.textContent).toBe('1:15');
    hud.dispose();
  });
  it('hotbar: maliyetler yazılı, yetersizse sönük, seçili vurgulu', () => {
    const hud = createHud(document.body);
    hud.update(fakeState(), 2); // 7 wood, 2 stone
    const slot = (k: string) => document.querySelector(`#hotbar .slot[data-kind="${k}"]`) as HTMLElement;
    expect(slot('fence').textContent).toContain('Fence');
    expect(slot('fence').textContent).toContain('5');
    expect(slot('fence').classList.contains('dim')).toBe(false);
    expect(slot('arrowTower').classList.contains('dim')).toBe(true); // 12 wood + 6 stone
    expect(slot('lantern').classList.contains('dim')).toBe(false); // 4 + 2
    hud.setBuild('lantern');
    expect(slot('lantern').classList.contains('on')).toBe(true);
    expect(slot('fence').classList.contains('on')).toBe(false);
    hud.setBuild(null);
    expect(slot('lantern').classList.contains('on')).toBe(false);
    hud.dispose();
  });
  it('ipucu ve game over ekranı', () => {
    const hud = createHud(document.body);
    const tip = document.querySelector('#build-tip') as HTMLElement;
    expect(tip.hidden).toBe(true);
    hud.setTip('Tree here — chop it first', 100, 200);
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe('Tree here — chop it first');
    expect(tip.style.left).toBe('100px');
    hud.setTip(null);
    expect(tip.hidden).toBe(true);
    const onRetry = vi.fn();
    const over = document.querySelector('#gameover') as HTMLElement;
    expect(over.hidden).toBe(true);
    hud.showGameOver(1, onRetry);
    expect(over.hidden).toBe(false);
    expect(over.textContent).toContain('The Hearth went out');
    expect(over.textContent).toContain('Night 1');
    (document.querySelector('#retry') as HTMLButtonElement).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
    hud.hideGameOver();
    expect(over.hidden).toBe(true);
    hud.dispose();
  });
  it('notice kısa uyarı gösterir ve süre dolunca gizler', () => {
    vi.useFakeTimers();
    const hud = createHud(document.body);
    const n = document.querySelector('#notice') as HTMLElement;
    expect(n.hidden).toBe(true);
    hud.notice('Not enough wood', 500);
    expect(n.hidden).toBe(false);
    expect(n.textContent).toBe('Not enough wood');
    vi.advanceTimersByTime(499);
    expect(n.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(n.hidden).toBe(true);
    hud.dispose();
    vi.useRealTimers();
  });
});
