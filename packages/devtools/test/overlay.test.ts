// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createDebugOverlay } from '../src/overlay';

const stats = { fps: 60, frameMs: 16.66, calls: 42, triangles: 12345, net: 'connected' };

describe('createDebugOverlay', () => {
  it('gizli başlar, toggle ile açılır/kapanır', () => {
    const o = createDebugOverlay(document.body);
    expect(document.querySelector('#debug-overlay')).toBe(o.el);
    expect(o.visible).toBe(false);
    o.toggle();
    expect(o.visible).toBe(true);
    o.toggle(false);
    expect(o.visible).toBe(false);
  });
  it('görünürken değerleri biçimleyerek yazar', () => {
    const o = createDebugOverlay(document.body);
    o.toggle(true);
    o.update(stats);
    const v = (k: string) => o.el.querySelector(`[data-key=${k}]`)?.textContent;
    expect(v('fps')).toBe('60');
    expect(v('frameMs')).toBe('16.7');
    expect(v('triangles')).toBe('12.3k');
    expect(v('net')).toBe('connected');
  });
  it('gizliyken güncellemez', () => {
    const o = createDebugOverlay(document.body);
    o.update(stats);
    expect(o.el.querySelector('[data-key=fps]')?.textContent).toBe('–');
  });
});
