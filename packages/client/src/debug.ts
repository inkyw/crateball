import type { DebugBridge, DebugOverlay } from '@gg/devtools';
import {
  type BuildableKind,
  type BuildingKind,
  type CreatureKind,
  DIRS,
  type ResourceKind,
  type Rotation,
  WATER,
  buildingCenter,
  cellCenter,
  cellCoords,
  cidx,
  hashState,
  ids,
  inGrid,
  spawnCells,
} from '@gg/sim';
import type { Game } from './game';
import { createDebugView } from './render/debug-view';

export interface DebugTools {
  update(): void;
  extra(): Record<string, string | number>;
}

const CREATURE_KINDS: readonly CreatureKind[] = ['shadeling', 'stumpkin', 'glowbug'];
/** `timeScale` komutunun üst sınırı (debug hızlandırma). */
const MAX_TIME_SCALE = 20;
const NODE_KINDS: readonly ResourceKind[] = ['tree', 'rock', 'bush'];
const num = (v: unknown, name: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${name}: number expected`);
  return v;
};

/** window.__game komutları (sadece dev). Playwright ve Claude in Chrome oyunu buradan yönetir. */
export function registerDebugCommands(bridge: DebugBridge, game: Game, overlay: DebugOverlay): DebugTools {
  const view = createDebugView(game.renderer);
  const S = () => game.session.state;
  const player = () => S().players[game.session.localPlayerId]!;

  // Tüm durum değişimleri oturumun komut kapısından geçer (session.command): snapshot/olay hattı oturumda kalır,
  // M2'de NetSession aynı komutları sunucuya iletir. Burada sim doğrudan DEĞİŞTİRİLMEZ.
  bridge.register('give', (wood = 0, stone = 0) => {
    game.session.command({ t: 'give', wood: num(wood, 'wood'), stone: num(stone, 'stone') });
    return { ...S().resources };
  });
  bridge.register('skipTo', (phase) => {
    if (phase !== 'day' && phase !== 'night') throw new Error("skipTo: 'day' | 'night'");
    game.session.command({ t: 'skipTo', phase });
    return { phase: S().phase, day: S().day, night: S().night };
  });
  bridge.register('restart', (seed) => {
    game.restart(seed === undefined ? undefined : num(seed, 'seed'));
    return S().seed;
  });
  bridge.register('timeScale', (x) => {
    // NaN/Infinity reddedilir (num fırlatır); negatif/aşırı değerler [0, MAX_TIME_SCALE]'e kırpılır (accumulator zehirlenmesin).
    game.session.timeScale = Math.min(MAX_TIME_SCALE, Math.max(0, num(x, 'timeScale')));
    return game.session.timeScale;
  });
  bridge.register('pause', () => {
    game.session.paused = true;
    return S().tick;
  });
  bridge.register('resume', () => {
    game.session.paused = false;
    return S().tick;
  });
  bridge.register('step', (n = 1) => {
    game.session.stepOnce(num(n, 'n')); // olaylar kuyruğa girer; game.frame bir sonraki karede işler (gameOver dahil)
    return S().tick;
  });
  bridge.register('spawn', (type, n = 1, near) => {
    if (!CREATURE_KINDS.includes(type as CreatureKind))
      throw new Error(`spawn: ${CREATURE_KINDS.join(' | ')}`);
    const count = num(n, 'n');
    const cells = spawnCells(S());
    const nearPt = near as { x: number; z: number } | undefined;
    for (let k = 0; k < count; k++) {
      let x: number;
      let z: number;
      if (nearPt) {
        const a = (k / Math.max(1, count)) * Math.PI * 2;
        const r = 1.5 + (k % 5) * 0.6;
        x = nearPt.x + Math.cos(a) * r;
        z = nearPt.z + Math.sin(a) * r;
      } else {
        const [i, j] = cellCoords(cells[k % cells.length] as number);
        [x, z] = cellCenter(i, j);
      }
      game.session.command({ t: 'spawn', kind: type as CreatureKind, x, z });
    }
    return ids(S().creatures).length;
  });
  bridge.register('god', (on = true) => {
    game.session.command({ t: 'god', on: !!on });
    return player().god;
  });
  bridge.register('seed', () => S().seed);
  bridge.register('hash', () => hashState(S()));
  bridge.register('teleport', (x, z) => {
    game.session.command({ t: 'teleport', x: num(x, 'x'), z: num(z, 'z') });
    return { x: player().x, z: player().z };
  });
  bridge.register('aim', (x, z) => {
    game.aimOverride = x === null || x === undefined ? null : { x: num(x, 'x'), z: num(z, 'z') };
    return game.aimOverride;
  });
  bridge.register('build', (kind, i, j, rot = 0) => {
    // Normal yerleştirme hattı (doğrulama + maliyet + olaylar); sonuç listesi testlerde doğrulanır.
    const events = game.session.command({
      t: 'build',
      place: {
        kind: kind as BuildableKind,
        i: num(i, 'i'),
        j: num(j, 'j'),
        rot: (num(rot, 'rot') % 4) as Rotation,
      },
    });
    return events.map((e) => (e.t === 'buildRejected' ? `rejected: ${e.reason}` : e.t));
  });
  bridge.register('nearest', (kind) => {
    const p = player();
    /** Hedefin yanında durulabilecek boş zemin hücresi (e2e: baltayla vurmak için). */
    const standBeside = (i: number, j: number): { x: number; z: number } | null => {
      for (const [dx, dz] of DIRS) {
        if (!inGrid(i + dx, j + dz)) continue;
        const c = cidx(i + dx, j + dz);
        if (S().island.level[c] !== WATER && !S().island.ramp[c] && S().occ[c] === 0) {
          const [x, z] = cellCenter(i + dx, j + dz);
          return { x, z };
        }
      }
      return null;
    };
    let best: {
      x: number;
      z: number;
      i: number;
      j: number;
      id: number;
      stand: { x: number; z: number } | null;
    } | null = null;
    let bestD = Infinity;
    const consider = (x: number, z: number, i: number, j: number, id: number) => {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { x, z, i, j, id, stand: standBeside(i, j) };
      }
    };
    if (NODE_KINDS.includes(kind as ResourceKind))
      for (const id of ids(S().nodes)) {
        const n = S().nodes[id]!;
        if (n.kind === kind) consider(...cellCenter(n.i, n.j), n.i, n.j, id);
      }
    else
      for (const id of ids(S().buildings)) {
        const b = S().buildings[id]!;
        if (b.kind === (kind as BuildingKind)) {
          const c = buildingCenter(b);
          consider(c.x, c.z, b.i, b.j, id);
        }
      }
    return best;
  });

  const KEYS = ['flow', 'colliders', 'grid', 'lanterns'] as const;
  for (const k of KEYS) view.flags[k] = overlay.toggleState(k);
  return {
    update() {
      for (const k of KEYS) view.flags[k] = overlay.toggleState(k);
      game.debugGrid = view.flags.grid; // ızgara kararını game.frame çizimden önce verir
      view.update(S());
    },
    extra() {
      const s = game.summary();
      return {
        tick: s.tick,
        phase: `${s.phase} ${s.phase === 'day' ? s.day : s.night}`,
        creatures: Object.values(s.counts.creatures).reduce((a, b) => a + b, 0),
        hearth: s.hearth.hp,
        seed: s.seed,
      };
    },
  };
}
