import {
  BUILDINGS,
  type BuildableKind,
  HALF,
  HOTBAR,
  type PlaceCommand,
  type PlayerInput,
  type Rotation,
  type Vec2,
  cellOf,
} from '@gg/sim';

/** Kamera (1, 0.92, 1) yönünden bakar: ekran sağı = dünya (1,-1)/√2, ekran yukarısı = (-1,-1)/√2. */
export const ISO_RIGHT: Vec2 = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
export const ISO_UP: Vec2 = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
export function screenDirToWorld(sx: number, sy: number): Vec2 {
  const x = sx * ISO_RIGHT.x + sy * ISO_UP.x;
  const z = sx * ISO_RIGHT.z + sy * ISO_UP.z;
  const len = Math.hypot(x, z);
  // `+ 0` normalises -0 (0 × negative axis) to +0.
  return len > 1 ? { x: x / len + 0, z: z / len + 0 } : { x: x + 0, z: z + 0 };
}

/** Ayak izinin sol-üst hücresi: 2×2 en yakın hücre köşesine (kit `footprint`), 1×1 imlecin hücresine. */
export function footprintOrigin(kind: BuildableKind, x: number, z: number): [number, number] {
  if (BUILDINGS[kind].size === 2) return [Math.round(x + HALF) - 1, Math.round(z + HALF) - 1];
  return cellOf(x, z);
}

export type PickFn = (clientX: number, clientY: number) => Vec2 | null;
export interface BuildMode {
  kind: BuildableKind | null;
  rot: Rotation;
  dragStart: [number, number] | null;
}
export interface InputController {
  readonly build: BuildMode;
  readonly pointer: { x: number; y: number } | null;
  /** İmlecin altındaki dünya noktası (zemin raycast). */
  readonly hover: Vec2 | null;
  readInput(playerId: number): PlayerInput;
  dispose(): void;
}

const KEY_TO_SLOT: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2 };

export function createInput(
  target: HTMLElement,
  pick: PickFn,
  onBuildChange?: (kind: BuildableKind | null) => void,
): InputController {
  const keys = new Set<string>();
  const build: BuildMode = { kind: null, rot: 0, dragStart: null };
  let pointer: { x: number; y: number } | null = null;
  let hover: Vec2 | null = null;
  let attackHeld = false;
  /** Bas–bırak aynı karede olsa bile bir sonraki readInput'ta saldırı kenarı üretir. */
  let attackClicked = false;
  let pending: PlaceCommand | null = null;

  const setKind = (k: BuildableKind | null) => {
    build.kind = k;
    build.dragStart = null;
    onBuildChange?.(k);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    keys.add(e.code);
    const slot = KEY_TO_SLOT[e.code];
    if (slot !== undefined) {
      const k = HOTBAR[slot] as BuildableKind;
      setKind(build.kind === k ? null : k);
    } else if (e.code === 'KeyR' && build.kind)
      build.rot = ((build.rot + (e.shiftKey ? 3 : 1)) % 4) as Rotation;
    else if (e.code === 'Escape' && build.kind) setKind(null);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onBlur = () => {
    keys.clear();
    attackHeld = false;
  };
  const updateHover = (e: MouseEvent) => {
    pointer = { x: e.clientX, y: e.clientY };
    hover = pick(e.clientX, e.clientY);
  };
  const onPointerMove = (e: MouseEvent) => updateHover(e);
  const onPointerDown = (e: MouseEvent) => {
    updateHover(e);
    if (e.button === 2) {
      if (build.kind) setKind(null);
      return;
    }
    if (e.button !== 0) return;
    if (!build.kind) {
      attackHeld = true;
      attackClicked = true;
      return;
    }
    if (!hover) return;
    if (build.kind === 'fence') {
      build.dragStart = cellOf(hover.x, hover.z);
      return;
    }
    const [i, j] = footprintOrigin(build.kind, hover.x, hover.z);
    pending = { kind: build.kind, i, j, rot: build.rot };
  };
  const onPointerUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    attackHeld = false;
    if (build.kind === 'fence' && build.dragStart) {
      updateHover(e);
      const end = hover ? cellOf(hover.x, hover.z) : build.dragStart;
      pending = {
        kind: 'fence',
        i: build.dragStart[0],
        j: build.dragStart[1],
        rot: build.rot,
        cells: [build.dragStart, end],
      };
      build.dragStart = null;
    }
  };
  const onContextMenu = (e: Event) => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  target.addEventListener('contextmenu', onContextMenu);

  return {
    build,
    get pointer() {
      return pointer;
    },
    get hover() {
      return hover;
    },
    readInput(playerId) {
      // Kamera her kare hareket eder (takip/zoom): saklanan ekran koordinatından güncel matrislerle yeniden pick.
      if (pointer) hover = pick(pointer.x, pointer.y);
      const sx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const sy = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      const place = pending;
      pending = null;
      const attack = (attackHeld || attackClicked) && !build.kind;
      attackClicked = false;
      return {
        playerId,
        move: screenDirToWorld(sx, sy),
        aim: hover ? { x: hover.x, z: hover.z } : null,
        attack,
        place,
      };
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('contextmenu', onContextMenu);
      keys.clear();
    },
  };
}
