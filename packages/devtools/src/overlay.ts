export interface OverlayStats {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  net: string;
}

export interface DebugOverlay {
  readonly el: HTMLElement;
  readonly visible: boolean;
  toggle(force?: boolean): void;
  update(stats: OverlayStats): void;
}

const ROWS: ReadonlyArray<[keyof OverlayStats, string]> = [
  ['fps', 'FPS'],
  ['frameMs', 'CPU ms / frame'],
  ['calls', 'draw calls'],
  ['triangles', 'triangles'],
  ['net', 'connection'],
];

function format(key: keyof OverlayStats, v: number | string): string {
  if (typeof v === 'string') return v;
  if (key === 'frameMs') return v.toFixed(1);
  if (key === 'triangles' && v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function createDebugOverlay(parent: HTMLElement): DebugOverlay {
  const el = document.createElement('div');
  el.id = 'debug-overlay';
  el.hidden = true;
  el.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:1000;min-width:190px;padding:10px 12px;border-radius:12px;' +
    'background:rgba(20,26,51,.88);color:#FFF4E0;font:600 12px/1.7 Nunito,system-ui,sans-serif;pointer-events:none';
  const cells = new Map<keyof OverlayStats, HTMLElement>();
  for (const [key, label] of ROWS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:16px';
    const name = document.createElement('span');
    name.textContent = label;
    name.style.opacity = '0.7';
    const value = document.createElement('b');
    value.dataset.key = key;
    value.textContent = '–';
    row.append(name, value);
    el.append(row);
    cells.set(key, value);
  }
  parent.append(el);
  return {
    el,
    get visible() {
      return !el.hidden;
    },
    toggle(force) {
      el.hidden = force === undefined ? !el.hidden : !force;
    },
    update(stats) {
      if (el.hidden) return;
      for (const [key] of ROWS) {
        const cell = cells.get(key);
        if (cell) cell.textContent = format(key, stats[key]);
      }
    },
  };
}
