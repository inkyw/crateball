import { describe, expect, it } from 'vitest';
import { MAX_STEPS_PER_FRAME, STEP_MS, createLocalSession, idleInput } from '../src/session';

describe('createLocalSession', () => {
  it('50 ms başına bir adım; alpha ara konum', () => {
    const s = createLocalSession(1);
    expect(s.state.tick).toBe(0);
    expect(s.update(0)).toEqual([]);
    s.update(100);
    expect(s.state.tick).toBe(2);
    expect(s.alpha).toBe(0);
    s.update(125);
    expect(s.state.tick).toBe(2);
    expect(s.alpha).toBeCloseTo(0.5);
    expect(STEP_MS).toBe(50);
  });
  it('büyük dt en fazla MAX_STEPS_PER_FRAME adım atar (spiral yok)', () => {
    const s = createLocalSession(1);
    s.update(0);
    s.update(10_000);
    expect(s.state.tick).toBe(MAX_STEPS_PER_FRAME);
    s.update(10_050);
    expect(s.state.tick).toBe(MAX_STEPS_PER_FRAME + 1);
  });
  it('pause adım attırmaz; timeScale hızlandırır; stepOnce tek tek ilerletir', () => {
    const s = createLocalSession(1);
    s.update(0);
    s.paused = true;
    s.update(500);
    expect(s.state.tick).toBe(0);
    s.stepOnce(3);
    expect(s.state.tick).toBe(3);
    s.paused = false;
    s.timeScale = 10;
    s.update(550);
    expect(s.state.tick).toBe(3 + MAX_STEPS_PER_FRAME); // 500 ms × 10 → sınır
    s.timeScale = 2;
    s.update(600);
    expect(s.state.tick).toBe(3 + MAX_STEPS_PER_FRAME + 2);
  });
  it('prev adımdan önceki konumları tutar; place komutu tek adımda tüketilir ve null girdi onu silmez', () => {
    const s = createLocalSession(1);
    const pid = s.localPlayerId;
    s.state.resources.wood = 20;
    s.setInput({ ...idleInput(pid), move: { x: 1, z: 0 }, place: { kind: 'fence', i: 33, j: 37, rot: 0 } });
    s.setInput({ ...idleInput(pid), move: { x: 1, z: 0 } }); // place: null → bekleyen komut korunur
    s.update(0);
    const ev = s.update(50);
    expect(ev.some((e) => e.t === 'built')).toBe(true);
    expect(s.prev.players[pid]!.x).toBeLessThan(s.state.players[pid]!.x);
    const ev2 = s.update(100);
    expect(ev2.some((e) => e.t === 'built')).toBe(false);
    expect(s.state.resources.wood).toBe(15);
  });
  it('kısa tık: iki adım arasında bas–bırak tek adımda vuruşa dönüşür, sonra tekrarlamaz', () => {
    const s = createLocalSession(1);
    const pid = s.localPlayerId;
    s.update(0);
    s.setInput({ ...idleInput(pid), attack: true }); // kare A: adım yok
    s.setInput({ ...idleInput(pid), attack: false }); // kare B: bırakıldı
    s.update(50); // tek adım (tick 1)
    expect(s.state.players[pid]!.swingTick).toBe(1);
    s.update(600); // 10 adım daha
    expect(s.state.players[pid]!.swingTick).toBe(1);
  });
  it("stepOnce: hareket eder, görüntü güncel tick'e sabitlenir, olaylar bir sonraki update ile teslim edilir", () => {
    const s = createLocalSession(1);
    const pid = s.localPlayerId;
    s.state.resources.wood = 20;
    s.update(0);
    s.setInput({ ...idleInput(pid), move: { x: 1, z: 0 }, place: { kind: 'fence', i: 33, j: 37, rot: 0 } });
    const x0 = s.state.players[pid]!.x;
    const ev = s.stepOnce(5);
    expect(s.state.tick).toBe(5);
    expect(s.state.players[pid]!.x).toBeCloseTo(x0 + 1, 5);
    expect(s.prev.players[pid]!.x).toBe(s.state.players[pid]!.x); // sabitlendi
    expect(s.alpha).toBe(0);
    expect(ev.some((e) => e.t === 'built')).toBe(true);
    s.paused = true;
    const delivered = s.update(16);
    expect(delivered.filter((e) => e.t === 'built')).toHaveLength(1);
    expect(s.update(32)).toEqual([]);
  });
  it('stepOnce ile Hearth yıkılırsa gameOver olayı update hattından gelir', () => {
    const s = createLocalSession(1);
    s.command({ t: 'spawn', kind: 'stumpkin', x: 0.5, z: 1.6 });
    s.state.buildings[s.state.hearthId]!.hp = 1;
    const ev = s.stepOnce(1);
    expect(ev.some((e) => e.t === 'gameOver')).toBe(true);
    expect(s.state.over).toBe(true);
    expect(s.update(0).some((e) => e.t === 'gameOver')).toBe(true);
  });
  it('command: give/build/skipTo/teleport/god oturum içinden; snapshot yenilenir, olaylar kuyruğa girer', () => {
    const s = createLocalSession(1);
    const pid = s.localPlayerId;
    s.command({ t: 'give', wood: 5, stone: 2 });
    expect(s.state.resources).toEqual({ wood: 15, stone: 2 });
    const built = s.command({ t: 'build', place: { kind: 'fence', i: 33, j: 37, rot: 0 } });
    expect(built.map((e) => e.t)).toEqual(['built']);
    expect(s.state.flowDirty).toBe(false);
    s.command({ t: 'teleport', x: 3, z: 4 });
    expect(s.state.players[pid]).toMatchObject({ x: 3, z: 4 });
    expect(s.prev.players[pid]).toMatchObject({ x: 3, z: 4 });
    s.command({ t: 'god', on: true });
    expect(s.state.players[pid]!.god).toBe(true);
    const night = s.command({ t: 'skipTo', phase: 'night' });
    expect(s.state.phase).toBe('night');
    expect(night.some((e) => e.t === 'phaseChanged')).toBe(true);
    expect(night.filter((e) => e.t === 'creatureSpawned').length).toBeGreaterThan(0);
    const delivered = s.update(0);
    expect(delivered.filter((e) => e.t === 'built')).toHaveLength(1);
    expect(delivered.filter((e) => e.t === 'phaseChanged')).toHaveLength(1);
    expect(s.command({ t: 'skipTo', phase: 'night' })).toEqual([]); // zaten gece: no-op
  });
});
