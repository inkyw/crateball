import {
  BUILDINGS,
  type BuildableKind,
  type BuildingKind,
  type CreatureKind,
  ISSUE,
  type ResourceKind,
  type SimEvent,
  type Vec2,
  canAfford,
  cellOf,
  evaluatePlacement,
  fenceLineCells,
  footprintCells,
  ids,
} from '@gg/sim';
import { type Hud, createHud } from './hud';
import { type InputController, createInput, footprintOrigin } from './input';
import { RENDER } from './render/config';
import { type GameRenderer, createGameRenderer } from './render/renderer';
import { type Session, createLocalSession } from './session';

export interface GameStats {
  frame: number;
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
}
export interface GameSummary {
  seed: number;
  tick: number;
  phase: string;
  day: number;
  night: number;
  over: boolean;
  player: { x: number; z: number; yaw: number; hp: number; dead: boolean };
  hearth: { hp: number };
  resources: { wood: number; stone: number };
  counts: {
    creatures: Record<CreatureKind, number>;
    buildings: Record<BuildingKind, number>;
    nodes: Record<ResourceKind, number>;
    projectiles: number;
  };
  build: { kind: BuildableKind | null; rot: number };
}
export interface Game {
  readonly session: Session;
  readonly renderer: GameRenderer;
  readonly hud: Hud;
  readonly input: InputController;
  readonly stats: GameStats;
  readonly seed: number;
  /** Debug: fare yerine sabit nişan noktası. */
  aimOverride: Vec2 | null;
  /** F1 "Grid" anahtarı; ızgara görünürlüğü çizimden önce tek yerde `buildMode || debugGrid` olarak belirlenir. */
  debugGrid: boolean;
  frame(nowMs: number): SimEvent[];
  /** "Try again" / debug: YENİ seed (varsayılan seed + 1) ile yeni run. */
  restart(newSeed?: number): void;
  summary(): GameSummary;
  dispose(): void;
}
export interface StartGameOptions {
  canvas: HTMLCanvasElement;
  hudParent: HTMLElement;
  seed: number;
}

const costText = (kind: BuildableKind): string => {
  const c = BUILDINGS[kind].cost;
  return `${c.wood} wood${c.stone ? ` · ${c.stone} stone` : ''}${kind === 'fence' ? ' / cell' : ''}`;
};

export function startGame(o: StartGameOptions): Game {
  const renderer = createGameRenderer(o.canvas);
  const hud = createHud(o.hudParent);
  const input = createInput(
    o.canvas,
    (x, y) => renderer.pick(x, y),
    (kind) => hud.setBuild(kind),
  );
  let session = createLocalSession(o.seed);
  let seed = o.seed;
  renderer.setWorld(session.state);
  const stats: GameStats = { frame: 0, fps: 0, frameMs: 0, calls: 0, triangles: 0 };
  let fpsAcc = 0;
  let fpsN = 0;
  let lastNow: number | null = null;
  const onWheel = (e: WheelEvent) =>
    renderer.camera.setZoom(
      renderer.camera.zoom * (e.deltaY > 0 ? 1 - RENDER.zoomStep : 1 + RENDER.zoomStep),
    );
  o.canvas.addEventListener('wheel', onWheel, { passive: true });

  /** Önizleme sim ile aynı kuralları uygular: hücre uygunluğu + kaynak (çitte ödenebilen hücre sayısı). */
  const updateBuildPreview = () => {
    const b = input.build;
    const state = session.state;
    const hover = input.hover;
    const pointer = input.pointer;
    if (!b.kind || !hover || !pointer) {
      renderer.setBuildPreview(null);
      hud.setTip(null);
      return;
    }
    const cells =
      b.kind === 'fence'
        ? b.dragStart
          ? fenceLineCells(b.dragStart, cellOf(hover.x, hover.z))
          : [cellOf(hover.x, hover.z)]
        : footprintCells(b.kind, ...footprintOrigin(b.kind, hover.x, hover.z));
    const evals = evaluatePlacement(state, b.kind, cells);
    const afford = canAfford(state, b.kind);
    if (b.kind === 'fence') {
      // Sim gibi: uygun hücreler sırayla ödenir; odun bitince kalanlar "Not enough wood".
      const affordable = Math.floor(state.resources.wood / BUILDINGS.fence.cost.wood);
      let used = 0;
      for (const c of evals) {
        if (c.issue) continue;
        if (used >= affordable) c.issue = ISSUE.wood;
        else used++;
      }
    } else if (afford) for (const c of evals) c.issue ??= afford;
    const bad = evals.find((c) => c.issue);
    const okCount = evals.filter((c) => !c.issue).length;
    renderer.setBuildPreview({ kind: b.kind, cells: evals, rot: b.rot, allOk: !bad });
    const text =
      bad && b.kind !== 'fence'
        ? (bad.issue as string)
        : bad
          ? `${okCount} cells placed · ${evals.length - okCount} blocked: ${bad.issue}`
          : `${BUILDINGS[b.kind].name} · ${costText(b.kind)}`;
    hud.setTip(text, pointer.x, pointer.y);
  };

  const game: Game = {
    get session() {
      return session;
    },
    renderer,
    hud,
    input,
    stats,
    get seed() {
      return seed;
    },
    aimOverride: null,
    debugGrid: false,
    frame(now) {
      const t0 = performance.now();
      const pid = session.localPlayerId;
      const inp = input.readInput(pid);
      if (game.aimOverride) inp.aim = { ...game.aimOverride };
      session.setInput(inp);
      const events = session.update(now); // stepOnce/command ile kuyruğa girenler de burada gelir
      for (const e of events) {
        if (e.t === 'gameOver') hud.showGameOver(session.state.night, () => game.restart());
        else if (e.t === 'buildRejected' && e.playerId === pid) hud.notice(e.reason);
      }
      hud.update(session.state, pid);
      updateBuildPreview();
      renderer.setGridVisible(input.build.kind !== null || game.debugGrid); // çizimden önce tek karar
      const r = renderer.render(session.state, session.prev, session.alpha, pid, now);
      stats.frame++;
      stats.calls = r.calls;
      stats.triangles = r.triangles;
      stats.frameMs = performance.now() - t0;
      if (lastNow !== null) {
        fpsAcc += now - lastNow;
        fpsN++;
        if (fpsAcc >= 500) {
          stats.fps = Math.round((fpsN * 1000) / fpsAcc);
          fpsAcc = 0;
          fpsN = 0;
        }
      }
      lastNow = now;
      return events;
    },
    restart(newSeed = seed + 1) {
      hud.hideGameOver();
      seed = newSeed >>> 0;
      session = createLocalSession(seed);
      renderer.setWorld(session.state);
    },
    summary() {
      const s = session.state;
      const p = s.players[session.localPlayerId];
      const creatures: Record<CreatureKind, number> = { shadeling: 0, stumpkin: 0, glowbug: 0 };
      const buildings: Record<BuildingKind, number> = { hearth: 0, fence: 0, arrowTower: 0, lantern: 0 };
      const nodes: Record<ResourceKind, number> = { tree: 0, rock: 0, bush: 0 };
      for (const id of ids(s.creatures)) creatures[s.creatures[id]!.kind]++;
      for (const id of ids(s.buildings)) buildings[s.buildings[id]!.kind]++;
      for (const id of ids(s.nodes)) nodes[s.nodes[id]!.kind]++;
      return {
        seed: s.seed,
        tick: s.tick,
        phase: s.phase,
        day: s.day,
        night: s.night,
        over: s.over,
        player: p
          ? { x: p.x, z: p.z, yaw: p.yaw, hp: p.hp, dead: p.dead }
          : { x: 0, z: 0, yaw: 0, hp: 0, dead: true },
        hearth: { hp: s.buildings[s.hearthId]?.hp ?? 0 },
        resources: { ...s.resources },
        counts: { creatures, buildings, nodes, projectiles: ids(s.projectiles).length },
        build: { kind: input.build.kind, rot: input.build.rot },
      };
    },
    dispose() {
      o.canvas.removeEventListener('wheel', onWheel);
      input.dispose();
      hud.dispose();
      renderer.dispose();
    },
  };
  return game;
}
