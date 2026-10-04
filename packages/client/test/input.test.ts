// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { HALF } from '@gg/sim';
import { ISO_RIGHT, ISO_UP, createInput, footprintOrigin, screenDirToWorld } from '../src/input';

const key = (code: string, type: 'keydown' | 'keyup' = 'keydown', shiftKey = false) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, shiftKey, bubbles: true }));
const mouse = (el: HTMLElement, type: string, button: number, x = 100, y = 100) =>
  el.dispatchEvent(new MouseEvent(type, { button, clientX: x, clientY: y, bubbles: true }));

function setup(pick = (x: number, y: number) => ({ x: (x - 100) / 10, z: (y - 100) / 10 })) {
  const el = document.createElement('canvas');
  document.body.append(el);
  const changes: (string | null)[] = [];
  const input = createInput(el, pick, (k) => changes.push(k));
  return { el, input, changes };
}

describe('yön eşlemesi', () => {
  it('W ekranda yukarı = dünya (-1,-1)/√2; D sağ = (1,-1)/√2', () => {
    expect(ISO_UP.x).toBeCloseTo(-Math.SQRT1_2);
    expect(ISO_RIGHT.z).toBeCloseTo(-Math.SQRT1_2);
    const w = screenDirToWorld(0, 1);
    expect(w.x).toBeCloseTo(-Math.SQRT1_2);
    expect(w.z).toBeCloseTo(-Math.SQRT1_2);
    expect(Math.hypot(screenDirToWorld(1, 1).x, screenDirToWorld(1, 1).z)).toBeCloseTo(1);
  });
  it('footprintOrigin: 2×2 en yakın köşeye, 1×1 hücreye oturur', () => {
    expect(footprintOrigin('arrowTower', 0.1, 0.1)).toEqual([HALF - 1, HALF - 1]);
    expect(footprintOrigin('arrowTower', 0.9, 0.9)).toEqual([HALF, HALF]);
    expect(footprintOrigin('lantern', 0.9, 0.9)).toEqual([HALF, HALF]);
    expect(footprintOrigin('fence', -0.1, 2.3)).toEqual([HALF - 1, HALF + 2]);
  });
});

describe('createInput', () => {
  it('WASD hareket; bırakınca durur', () => {
    const { input } = setup();
    key('KeyW');
    let i = input.readInput(1);
    expect(i.move.x).toBeCloseTo(-Math.SQRT1_2);
    key('KeyD');
    i = input.readInput(1);
    expect(i.move.z).toBeCloseTo(-1);
    key('KeyW', 'keyup');
    key('KeyD', 'keyup');
    expect(input.readInput(1).move).toEqual({ x: 0, z: 0 });
    input.dispose();
  });
  it('nişan fareden; sol tık balta (inşa modu yokken)', () => {
    const { el, input } = setup();
    mouse(el, 'pointermove', 0, 150, 120);
    expect(input.readInput(1).aim).toEqual({ x: 5, z: 2 });
    mouse(el, 'pointerdown', 0, 150, 120);
    expect(input.readInput(1).attack).toBe(true);
    expect(input.readInput(1).place).toBeNull();
    mouse(el, 'pointerup', 0, 150, 120);
    expect(input.readInput(1).attack).toBe(false);
    input.dispose();
  });
  it('tek karede bas–bırak bile bir saldırı kenarı üretir (sonra false)', () => {
    const { el, input } = setup();
    mouse(el, 'pointerdown', 0);
    mouse(el, 'pointerup', 0);
    expect(input.readInput(1).attack).toBe(true);
    expect(input.readInput(1).attack).toBe(false);
    input.dispose();
  });
  it('nişan her okumada yeniden pick edilir (kamera hareket edince fare sabit kalsa da)', () => {
    let offset = 0;
    const { el, input } = setup((x, y) => ({ x: (x - 100) / 10 + offset, z: (y - 100) / 10 }));
    mouse(el, 'pointermove', 0, 150, 100);
    expect(input.readInput(1).aim).toEqual({ x: 5, z: 0 });
    offset = 2; // kamera kaydı; pointermove yok
    expect(input.readInput(1).aim).toEqual({ x: 7, z: 0 });
    expect(input.hover).toEqual({ x: 7, z: 0 });
    input.dispose();
  });
  it('1–3 bina seçer, aynı tuş kapatır, R döndürür, Esc/sağ tık iptal', () => {
    const { el, input, changes } = setup();
    key('Digit2');
    expect(input.build.kind).toBe('arrowTower');
    key('KeyR');
    key('KeyR');
    expect(input.build.rot).toBe(2);
    key('KeyR', 'keydown', true);
    expect(input.build.rot).toBe(1);
    key('Digit2');
    expect(input.build.kind).toBeNull();
    key('Digit3');
    key('Escape');
    expect(input.build.kind).toBeNull();
    key('Digit1');
    mouse(el, 'pointerdown', 2);
    expect(input.build.kind).toBeNull();
    expect(changes).toEqual(['arrowTower', null, 'lantern', null, 'fence', null]);
    input.dispose();
  });
  it('kule: tık → place komutu (tek seferlik); fener: tık → place', () => {
    const { el, input } = setup();
    key('Digit2');
    mouse(el, 'pointermove', 0, 109, 109); // dünya (0.9, 0.9)
    mouse(el, 'pointerdown', 0, 109, 109);
    const i = input.readInput(1);
    expect(i.attack).toBe(false);
    expect(i.place).toEqual({ kind: 'arrowTower', i: HALF, j: HALF, rot: 0 });
    expect(input.readInput(1).place).toBeNull();
    mouse(el, 'pointerup', 0, 109, 109);
    input.dispose();
  });
  it('çit: bas-sürükle-bırak → cells [başlangıç, bitiş]; sürüklerken dragStart dolu', () => {
    const { el, input } = setup();
    key('Digit1');
    mouse(el, 'pointermove', 0, 100, 100); // (0,0) → hücre (HALF, HALF)
    mouse(el, 'pointerdown', 0, 100, 100);
    expect(input.build.dragStart).toEqual([HALF, HALF]);
    expect(input.readInput(1).place).toBeNull();
    mouse(el, 'pointermove', 0, 140, 103); // (4, 0.3) → (HALF+4, HALF)
    mouse(el, 'pointerup', 0, 140, 103);
    expect(input.build.dragStart).toBeNull();
    expect(input.readInput(1).place).toEqual({
      kind: 'fence',
      i: HALF,
      j: HALF,
      rot: 0,
      cells: [
        [HALF, HALF],
        [HALF + 4, HALF],
      ],
    });
    input.dispose();
  });
  it('dispose dinleyicileri kaldırır', () => {
    const { input } = setup();
    input.dispose();
    key('KeyW');
    expect(input.readInput(1).move).toEqual({ x: 0, z: 0 });
  });
  it('sürükleme sırasında blur: hareket/saldırı ve çit sürüklemesi iptal; pointerup yerleştirme üretmez', () => {
    const { el, input } = setup();
    key('Digit1'); // çit
    mouse(el, 'pointerdown', 0, 100, 100);
    window.dispatchEvent(new Event('blur'));
    expect(input.build.dragStart).toBeNull();
    window.dispatchEvent(new MouseEvent('pointerup', { button: 0, clientX: 140, clientY: 103 }));
    expect(input.readInput(1).place).toBeNull();
    input.dispose();
  });
  it('pointercancel çit sürüklemesini iptal eder; başka hareketle başlamamış bırakma yerleştirmez', () => {
    const { el, input } = setup();
    key('Digit1');
    mouse(el, 'pointerdown', 0, 100, 100);
    window.dispatchEvent(new Event('pointercancel'));
    expect(input.build.dragStart).toBeNull();
    window.dispatchEvent(new MouseEvent('pointerup', { button: 0, clientX: 140, clientY: 103 }));
    expect(input.readInput(1).place).toBeNull();
    input.dispose();
  });
  it('blur bekleyen tık kenarını (balta) siler', () => {
    const { el, input } = setup();
    mouse(el, 'pointerdown', 0);
    window.dispatchEvent(new Event('blur'));
    expect(input.readInput(1).attack).toBe(false);
    input.dispose();
  });
});
