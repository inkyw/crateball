import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/content/buildings';
import { CREATURES, SEPARATION } from '../src/content/creatures';
import { PLAYER } from '../src/content/player';
import { cellIndexAt, cellOf } from '../src/grid';
import { addBuilding, createGame, ids, spawnCreature } from '../src/state';
import { step } from '../src/step';
import { applyPlacement } from '../src/systems/build';
import { removeBuilding } from '../src/systems/combat';
import { inLanternLight, updateCreatures } from '../src/systems/creatures';
import { spawnCells } from '../src/systems/waves';
import type { SimEvent } from '../src/types';
import { cellCenter, cellCoords } from '../src/grid';

const run = (s: ReturnType<typeof createGame>, n: number) => {
  const all: SimEvent[] = [];
  for (let k = 0; k < n; k++) all.push(...step(s, []).events);
  return all;
};
/** Hearth'tan uzak, Hearth'a yolu olan bir kıyı hücresinin merkezi (gerçek doğma noktası). */
const farSpawn = (s: ReturnType<typeof createGame>) => {
  const [i, j] = cellCoords(spawnCells(s)[0]!);
  const [x, z] = cellCenter(i, j);
  return { x, z };
};
/** Hearth'ı 7×7'lik kapalı çit halkasıyla çevirir (köşe (35,35) çapraz olduğu için sızdırmaz). */
const fenceRing = (s: ReturnType<typeof createGame>) => {
  for (let d = -3; d <= 3; d++) {
    addBuilding(s, 'fence', 31 + d, 28, 0);
    addBuilding(s, 'fence', 31 + d, 35, 0);
    addBuilding(s, 'fence', 28, 31 + d, 0);
    addBuilding(s, 'fence', 35, 31 + d, 0);
  }
};

describe('Shadeling', () => {
  it("oyuncu yoksa flow ile Hearth'a yaklaşır", () => {
    const s = createGame(1);
    const p = s.players[ids(s.players)[0]!]!;
    p.dead = true;
    p.respawnAtTick = 1e9;
    const { x, z } = farSpawn(s);
    const c = spawnCreature(s, 'shadeling', x, z);
    const d0 = s.flow.hearth.dist[cellIndexAt(x, z)]!;
    run(s, 40);
    const d1 = s.flow.hearth.dist[cellIndexAt(c.x, c.z)]!;
    expect(d1).toBeLessThan(d0);
  });
  it('6 birimde oyuncuyu görünce kovalar ve temasta 8 hasar/sn verir', () => {
    const s = createGame(1);
    const p = s.players[ids(s.players)[0]!]!;
    const c = spawnCreature(s, 'shadeling', p.x + 4, p.z);
    run(s, 10);
    expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeLessThan(4);
    expect(c.targetId).toBe(p.id);
    const s2 = createGame(1);
    const p2 = s2.players[ids(s2.players)[0]!]!;
    spawnCreature(s2, 'shadeling', p2.x + 0.7, p2.z);
    run(s2, 20);
    expect(p2.hp).toBeCloseTo(PLAYER.maxHp - CREATURES.shadeling.contactDps! * 1, 5);
  });
  it('Hearth çitle çevriliyse çite saldırır, çit yıkılınca alan yenilenir ve içeri girer', () => {
    const s = createGame(1);
    const p = s.players[ids(s.players)[0]!]!;
    p.dead = true;
    p.respawnAtTick = 1e9;
    fenceRing(s);
    const c = spawnCreature(s, 'shadeling', 0.5, 6.5);
    run(s, 40);
    const fences = ids(s.buildings)
      .map((id) => s.buildings[id]!)
      .filter((b) => b.kind === 'fence');
    const damaged = fences.find((f) => f.hp < BUILDINGS.fence.hp);
    expect(damaged).toBeDefined();
    expect(c.targetId).toBe(damaged!.id);
    const events = run(s, 400);
    expect(events.some((e) => e.t === 'buildingDestroyed' && e.kind === 'fence')).toBe(true);
    expect(s.flowDirty).toBe(false);
    expect(Math.hypot(c.x, c.z)).toBeLessThan(5);
  });
  it('CANLI oyuncu kapalı çitin arkasındayken kovalayan Shadeling takılı kalmaz: çite saldırır', () => {
    const s = createGame(1);
    const p = s.players[ids(s.players)[0]!]!;
    p.god = true;
    p.x = 0;
    p.z = 0.5; // halkanın içinde (hücre (32,32)), çit satırlarından uzakta
    fenceRing(s);
    const c = spawnCreature(s, 'shadeling', 0.5, 6.5); // oyuncuya 3 birim → kovalar, çit engeller
    run(s, 60);
    const fences = ids(s.buildings)
      .map((id) => s.buildings[id]!)
      .filter((b) => b.kind === 'fence');
    const damaged = fences.find((f) => f.hp < BUILDINGS.fence.hp);
    expect(damaged).toBeDefined();
    expect(c.targetId).toBe(damaged!.id);
    expect(p.hp).toBe(PLAYER.maxHp);
  });
  it('8 çitle çevrili oyuncunun etrafında salınmaz: bir çite saldırır (tam step hattı)', () => {
    const s = createGame(1);
    const pid = ids(s.players)[0]!;
    const p = s.players[pid]!;
    p.god = true;
    p.x = 4.5;
    p.z = 3.5;
    s.resources = { wood: 1000, stone: 1000 };
    const ev: SimEvent[] = [];
    const cells: [number, number][] = [];
    for (let i = 35; i <= 37; i++)
      for (let j = 34; j <= 36; j++) if (i !== 36 || j !== 35) cells.push([i, j]);
    for (const [i, j] of cells) applyPlacement(s, pid, { kind: 'fence', i, j, rot: 0, cells: [[i, j]] }, ev);
    expect(ev.filter((e) => e.t === 'built')).toHaveLength(8);
    const c = spawnCreature(s, 'shadeling', 1.5, 3.5);
    const events = run(s, 600);
    // Çit ya hasar aldı ya da yıkıldı; yaratık çevresinde salınıp kalmadı.
    const hit = events.some((e) => e.t === 'buildingDestroyed' && e.kind === 'fence');
    const damaged = ids(s.buildings).some((id) => {
      const b = s.buildings[id]!;
      return b.kind === 'fence' && b.hp < BUILDINGS.fence.hp;
    });
    expect(hit || damaged).toBe(true);
    expect(c.targetId).not.toBe(0);
  });
  it('oyuncu ve yaratık daireleri iç içe geçmez (temas çözümü arazi kurallarına uyar)', () => {
    const s = createGame(1);
    const pid = ids(s.players)[0]!;
    const p = s.players[pid]!;
    const st = spawnCreature(s, 'stumpkin', p.x + 1.5, p.z);
    const minD = PLAYER.radius + CREATURES.stumpkin.radius;
    const z0 = p.z;
    for (let k = 0; k < 30; k++) {
      step(s, [{ playerId: pid, move: { x: 1, z: 0 }, aim: null, attack: false, place: null }]);
      expect(Math.hypot(p.x - st.x, p.z - st.z)).toBeGreaterThanOrEqual(minD - 1e-6);
      expect(Number.isFinite(p.x) && Number.isFinite(st.x)).toBe(true);
    }
    // Stumpkin Hearth'a yürüyüp yoldan çekildiği için oyuncu içinden geçmez, yandan kayıp geçer (itildi).
    expect(p.z).toBeGreaterThan(z0);
  });
});

describe('Stumpkin ve Glowbug', () => {
  it("Stumpkin Hearth'a 20 hasar / 1.5 sn vurur", () => {
    const s = createGame(1);
    spawnCreature(s, 'stumpkin', 0.5, 1.6);
    run(s, 1);
    expect(s.buildings[s.hearthId]!.hp).toBe(480);
    run(s, 29);
    expect(s.buildings[s.hearthId]!.hp).toBe(480);
    run(s, 1);
    expect(s.buildings[s.hearthId]!.hp).toBe(460);
  });
  it('Glowbug en yakın fenere gider ve söndürür (10/sn)', () => {
    const s = createGame(1);
    const lantern = addBuilding(s, 'lantern', 36, 36, 0);
    spawnCreature(s, 'glowbug', 8.5, 4.5);
    run(s, 80);
    expect(s.buildings[lantern.id]!.hp).toBeLessThan(BUILDINGS.lantern.hp);
    const events = run(s, 200);
    expect(events.some((e) => e.t === 'buildingDestroyed' && e.kind === 'lantern')).toBe(true);
  });
  it("hedef bina aynı tick'te yok olursa hata vermez ve yeni hedef seçer", () => {
    const s = createGame(1);
    const lantern = addBuilding(s, 'lantern', 36, 36, 0);
    const g = spawnCreature(s, 'glowbug', 4.5 - 0.6, 4.5);
    run(s, 2);
    expect(g.targetId).toBe(lantern.id);
    removeBuilding(s, lantern, []);
    expect(() => run(s, 5)).not.toThrow();
    expect(g.targetId).not.toBe(lantern.id);
  });
});

describe('fener etkisi ve ayrışma', () => {
  it('ışıkta Shadeling 3 hasar/sn alır ve %40 yavaşlar', () => {
    const s = createGame(1);
    const p = s.players[ids(s.players)[0]!]!;
    p.dead = true;
    p.respawnAtTick = 1e9;
    addBuilding(s, 'lantern', 36, 36, 0); // merkez (4.5, 4.5)
    expect(inLanternLight(s, 6.5, 4.5)).toBe(true);
    expect(inLanternLight(s, 9.5, 4.5)).toBe(false);
    const lit = spawnCreature(s, 'shadeling', 6.5, 3.5);
    const dark = spawnCreature(s, 'shadeling', -6.5, 3.5);
    let litPath = 0;
    let darkPath = 0;
    for (let k = 0; k < 10; k++) {
      const a = { x: lit.x, z: lit.z };
      const b = { x: dark.x, z: dark.z };
      step(s, []);
      litPath += Math.hypot(lit.x - a.x, lit.z - a.z);
      darkPath += Math.hypot(dark.x - b.x, dark.z - b.z);
    }
    expect(litPath / darkPath).toBeCloseTo(1 - BUILDINGS.lantern.slowFactor!, 1);
    expect(lit.hp).toBeCloseTo(CREATURES.shadeling.hp - BUILDINGS.lantern.shadelingDps! * 0.5, 5);
    expect(dark.hp).toBe(CREATURES.shadeling.hp);
  });
  it('aynı noktaya doğan iki yaratık birbirini iter', () => {
    const s = createGame(1);
    const { x, z } = farSpawn(s);
    const a = spawnCreature(s, 'stumpkin', x, z);
    const b = spawnCreature(s, 'stumpkin', x, z);
    const events: SimEvent[] = [];
    for (let k = 0; k < 10; k++) updateCreatures(s, events);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.2);
  });
  it('yoğun küme: 50 yaratık aynı noktada → itme sınırlı, adım bir hücreden küçük, NaN yok', () => {
    const s = createGame(1);
    s.players[ids(s.players)[0]!]!.dead = true;
    const { x, z } = farSpawn(s);
    const list = Array.from({ length: 50 }, () => spawnCreature(s, 'shadeling', x, z));
    const maxStep = SEPARATION.maxPush + CREATURES.shadeling.speed * 0.05 + 1e-9;
    for (let k = 0; k < 20; k++) {
      const before = list.map((c) => [c.x, c.z]);
      updateCreatures(s, []);
      list.forEach((c, i) => {
        expect(Number.isFinite(c.x) && Number.isFinite(c.z)).toBe(true);
        expect(Math.hypot(c.x - before[i]![0]!, c.z - before[i]![1]!)).toBeLessThanOrEqual(maxStep);
      });
    }
    const positions = new Set(list.map((c) => `${c.x.toFixed(4)},${c.z.toFixed(4)}`));
    expect(positions.size).toBeGreaterThan(40);
    for (const c of list) expect(Math.hypot(c.x - x, c.z - z)).toBeLessThan(6);
  });
  it('fener ışığı kontrolü Hearth çevresi dışındaki hücrelere konan feneri kullanır', () => {
    const s = createGame(1);
    const [i, j] = cellOf(6.5, 0.5);
    addBuilding(s, 'lantern', i, j, 0);
    expect(inLanternLight(s, 6.5, 3.5)).toBe(true);
    expect(inLanternLight(s, 6.5, 5.5)).toBe(false);
  });
});

describe('oyuncu–yaratık temas çözümü', () => {
  it('oyuncu duvara dayalıyken yaratık iterse artık nüfuz kalmaz', () => {
    const s = createGame(1);
    const pid = ids(s.players)[0]!;
    const p = s.players[pid]!;
    for (let j = 34; j <= 37; j++) addBuilding(s, 'fence', 35, j, 0); // x 3..4, z 2..6 duvarı
    p.x = 3 - PLAYER.radius - 0.001;
    p.z = 4.5;
    const c = spawnCreature(s, 'stumpkin', p.x - 0.6, p.z);
    const minD = PLAYER.radius + CREATURES.stumpkin.radius;
    updateCreatures(s, []);
    expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeGreaterThanOrEqual(minD - 0.02);
    expect(p.x).toBeLessThanOrEqual(3 - PLAYER.radius + 1e-6);
  });
  it('oyuncunun iki yanındaki yaratıklar: ikisiyle de örtüşme kalmaz', () => {
    const s = createGame(1);
    const p = s.players[ids(s.players)[0]!]!;
    const a = spawnCreature(s, 'stumpkin', p.x - 0.6, p.z);
    const b = spawnCreature(s, 'stumpkin', p.x + 0.6, p.z + 0.05);
    const minD = PLAYER.radius + CREATURES.stumpkin.radius;
    updateCreatures(s, []);
    expect(Math.hypot(a.x - p.x, a.z - p.z)).toBeGreaterThanOrEqual(minD - 0.02);
    expect(Math.hypot(b.x - p.x, b.z - p.z)).toBeGreaterThanOrEqual(minD - 0.02);
  });
});
