export interface OverlayStats {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  net: string;
}
export interface OverlayToggle {
  key: string;
  label: string;
}
export interface OverlayOptions {
  toggles?: OverlayToggle[];
  onToggle?: (key: string, on: boolean) => void;
}
export interface DebugOverlay {
  readonly el: HTMLElement;
  readonly visible: boolean;
  toggle(force?: boolean): void;
  update(stats: OverlayStats, extra?: Record<string, string | number>): void;
  toggleState(key: string): boolean;
}

const ROWS: ReadonlyArray<[keyof OverlayStats, string]> = [
  ['fps', 'FPS'],
  ['frameMs', 'CPU ms / frame'],
  ['calls', 'draw calls'],
  ['triangles', 'triangles'],
  ['net', 'connection'],
];

function format(key: string, v: number | string): string {
  if (typeof v === 'string') return v;
  if (key === 'frameMs') return v.toFixed(1);
  if (key === 'triangles' && v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function createDebugOverlay(parent: HTMLElement, options: OverlayOptions = {}): DebugOverlay {
  const el = document.createElement('div');
  el.id = 'debug-overlay';
  el.hidden = true;
  el.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:1000;min-width:190px;padding:10px 12px;border-radius:12px;' +
    'background:rgba(20,26,51,.88);color:#FFF4E0;font:600 12px/1.7 Nunito,system-ui,sans-serif;pointer-events:none';
  const cells = new Map<string, HTMLElement>();
  const addRow = (key: string, label: string): HTMLElement => {
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
    return value;
  };
  for (const [key, label] of ROWS) addRow(key, label);
  const states = new Map<string, boolean>();
  if (options.toggles?.length) {
    const box = document.createElement('div');
    box.style.cssText =
      'margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,244,224,.12);pointer-events:auto;display:grid;gap:2px';
    for (const t of options.toggles) {
      states.set(t.key, false);
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.toggle = t.key;
      input.addEventListener('change', () => {
        states.set(t.key, input.checked);
        options.onToggle?.(t.key, input.checked);
      });
      label.append(input, document.createTextNode(t.label));
      box.append(label);
    }
    el.append(box);
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
    update(stats, extra) {
      if (el.hidden) return;
      for (const [key] of ROWS) {
        const cell = cells.get(key);
        if (cell) cell.textContent = format(key, stats[key]);
      }
      if (extra)
        for (const [key, v] of Object.entries(extra))
          (cells.get(key) ?? addRow(key, key)).textContent = format(key, v);
    },
    toggleState(key) {
      return states.get(key) ?? false;
    },
  };
}
