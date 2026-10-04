import { DOWN, KICK, LEFT, RIGHT, UP, USE } from '@crateball/sim';

const KEYS: Record<string, number> = {
  ArrowUp: UP,
  KeyW: UP,
  ArrowDown: DOWN,
  KeyS: DOWN,
  ArrowLeft: LEFT,
  KeyA: LEFT,
  ArrowRight: RIGHT,
  KeyD: RIGHT,
  Space: KICK,
  KeyX: KICK,
  KeyE: USE,
  KeyF: USE,
  ShiftLeft: USE,
  ShiftRight: USE,
};

export interface Keyboard {
  bits(): number;
  release(): void;
}

/** Keyboard → input byte. Keys only count while the game (not a text field) has focus. */
export function createKeyboard(target: Window, onKey?: (code: string) => void): Keyboard {
  let bits = 0;
  const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement;
  target.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    const b = KEYS[e.code];
    if (b) {
      bits |= b;
      e.preventDefault();
    } else if (!e.repeat) onKey?.(e.code);
  });
  target.addEventListener('keyup', (e) => {
    const b = KEYS[e.code];
    if (b) bits &= ~b;
  });
  target.addEventListener('blur', () => (bits = 0));
  return {
    bits: () => bits,
    release: () => (bits = 0),
  };
}
