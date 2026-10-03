import {
  type CreatureKind,
  type GameState,
  type Phase,
  type PlaceCommand,
  type PlayerInput,
  type Pose,
  type PoseSnapshot,
  SIM_TICK_HZ,
  type SimEvent,
  applyPlacement,
  createGame,
  ids,
  refreshFlow,
  spawnCreature,
  step,
} from '@gg/sim';

export const STEP_MS = 1000 / SIM_TICK_HZ;
/** Sekme arka plandayken biriken zaman için üst sınır (spiral of death yok). */
export const MAX_STEPS_PER_FRAME = 10;

/** Render katmanı bu tipleri `@gg/sim`'den alır (Task 15 ∥ Task 16 bağımsız kalsın diye); burada yalnızca takma ad. */
export type PrevPose = Pose;
export type PrevPositions = PoseSnapshot;

/**
 * Oturum komutları (yalnızca DEV/debug): durum değişimi, snapshot yenileme ve olay teslimi oturumun İÇİNDE kalır;
 * istemci sim'e doğrudan dokunmaz. M2'de NetSession bu komutları sunucuya debug mesajı olarak iletir.
 */
export type SessionCommand =
  | { t: 'give'; wood: number; stone: number }
  | { t: 'skipTo'; phase: Phase }
  | { t: 'spawn'; kind: CreatureKind; x: number; z: number }
  | { t: 'god'; on: boolean }
  | { t: 'teleport'; x: number; z: number }
  | { t: 'build'; place: PlaceCommand };

/** Oyun oturumu: M1'de yerel sim; M2'de aynı arayüzle NetSession. */
export interface Session {
  readonly state: GameState;
  /** Son adımdan ÖNCEKİ konumlar; render `prev → state` arasında `alpha` ile interpolasyon yapar. */
  readonly prev: PrevPositions;
  readonly alpha: number;
  readonly localPlayerId: number;
  timeScale: number;
  paused: boolean;
  /**
   * Sonraki adımlarda kullanılacak girdi. `place` ve `attack` kenarı en az bir sim adımında tüketilene kadar saklanır;
   * sonraki girdideki `place: null` / `attack: false` bekleyeni silmez (kısa tıklar adımlar arasında kaybolmaz).
   */
  setInput(input: PlayerInput): void;
  /** Sabit adımlar. Döndürdüğü olaylar `stepOnce`/`command` ile kuyruğa girmiş bekleyenleri de içerir (tek olay hattı). */
  update(nowMs: number): SimEvent[];
  /** Manuel adım: olaylar hem döner hem kuyruğa girer; görüntü güncel tick'e sabitlenir (prev = state, alpha = 0). */
  stepOnce(n?: number): SimEvent[];
  /** Debug komutu; olaylar hem döner hem kuyruğa girer; snapshot yenilenir. */
  command(cmd: SessionCommand): SimEvent[];
}

export const idleInput = (playerId: number): PlayerInput => ({
  playerId,
  move: { x: 0, z: 0 },
  aim: null,
  attack: false,
  place: null,
});

function snapshot(state: GameState): PrevPositions {
  const prev: PrevPositions = { players: {}, creatures: {}, projectiles: {} };
  for (const id of ids(state.players)) {
    const p = state.players[id]!;
    prev.players[id] = { x: p.x, z: p.z, yaw: p.yaw };
  }
  for (const id of ids(state.creatures)) {
    const c = state.creatures[id]!;
    prev.creatures[id] = { x: c.x, z: c.z, yaw: c.yaw };
  }
  for (const id of ids(state.projectiles)) {
    const p = state.projectiles[id]!;
    prev.projectiles[id] = { x: p.x, z: p.z, yaw: 0 };
  }
  return prev;
}

export function createLocalSession(seed: number): Session {
  const state = createGame(seed);
  const localPlayerId = ids(state.players)[0] as number;
  let prev = snapshot(state);
  let raw = idleInput(localPlayerId);
  let latchedAttack = false;
  let latchedPlace: PlaceCommand | null = null;
  const pending: SimEvent[] = [];
  let acc = 0;
  let last: number | null = null;
  let alpha = 0;

  const doStep = (): SimEvent[] => {
    prev = snapshot(state);
    const input: PlayerInput = {
      ...raw,
      attack: raw.attack || latchedAttack,
      place: latchedPlace ?? raw.place,
    };
    latchedAttack = false;
    latchedPlace = null;
    return step(state, [input]).events;
  };
  /** Manuel adım/komut sonrası: görüntü güncel tick'e sabitlenir. */
  const snap = () => {
    prev = snapshot(state);
    acc = 0;
    alpha = 0;
  };

  const session: Session = {
    get state() {
      return state;
    },
    get prev() {
      return prev;
    },
    get alpha() {
      return alpha;
    },
    localPlayerId,
    timeScale: 1,
    paused: false,
    setInput(i) {
      raw = i;
      if (i.attack) latchedAttack = true;
      if (i.place) latchedPlace = i.place;
    },
    update(now) {
      if (last === null) last = now;
      const dt = Math.max(0, now - last);
      last = now;
      const events = pending.splice(0);
      if (session.paused) return events;
      acc = Math.min(acc + dt * session.timeScale, MAX_STEPS_PER_FRAME * STEP_MS);
      while (acc >= STEP_MS) {
        events.push(...doStep());
        acc -= STEP_MS;
      }
      alpha = acc / STEP_MS;
      return events;
    },
    stepOnce(n = 1) {
      const events: SimEvent[] = [];
      for (let k = 0; k < n; k++) events.push(...doStep());
      snap();
      pending.push(...events);
      return events;
    },
    command(cmd) {
      const events: SimEvent[] = [];
      const p = state.players[localPlayerId];
      switch (cmd.t) {
        case 'give':
          state.resources.wood += cmd.wood;
          state.resources.stone += cmd.stone;
          break;
        case 'skipTo':
          if (state.phase !== cmd.phase) {
            state.phaseEndTick = state.tick;
            events.push(...doStep());
          }
          break;
        case 'spawn':
          spawnCreature(state, cmd.kind, cmd.x, cmd.z);
          break;
        case 'god':
          if (p) p.god = cmd.on;
          break;
        case 'teleport':
          if (p) {
            p.x = cmd.x;
            p.z = cmd.z;
          }
          break;
        case 'build':
          applyPlacement(state, localPlayerId, cmd.place, events);
          if (state.flowDirty) refreshFlow(state);
          break;
      }
      snap();
      pending.push(...events);
      return events;
    },
  };
  return session;
}
