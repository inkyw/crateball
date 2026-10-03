import './hud.css';
import { BUILDINGS, type BuildableKind, type GameState, HOTBAR, PLAYER, SIM_TICK_HZ } from '@gg/sim';

export interface Hud {
  root: HTMLElement;
  update(state: GameState, playerId: number): void;
  setBuild(kind: BuildableKind | null): void;
  setTip(text: string | null, x?: number, y?: number): void;
  /** Kısa uyarı (inşa reddi sebebi vb.); `ms` sonra kaybolur. */
  notice(text: string, ms?: number): void;
  showGameOver(night: number, onRetry: () => void): void;
  hideGameOver(): void;
  dispose(): void;
}
export const NOTICE_MS = 1800;

const ICON_LOG =
  '<svg class="i" viewBox="0 0 32 32"><rect x="3" y="10" width="24" height="13" rx="6.5" fill="#8C5A36"/><rect x="3" y="10" width="24" height="5" rx="2.5" fill="#A8704A"/><ellipse cx="24" cy="16.5" rx="5" ry="6.5" fill="#E2B27C"/></svg>';
const ICON_STONE =
  '<svg class="i" viewBox="0 0 32 32"><path d="M6 22 9 12l8-4 8 5 3 9-6 4H11z" fill="#9A958D"/><path d="M9 12l8-4 8 5-7 3z" fill="#B9B4AC"/></svg>';
const ICON_FLAME =
  '<svg class="i" viewBox="0 0 32 32"><path d="M16 2c1 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 4-10 1 3 2 4 3 4 0-4 0-7 2-11z" fill="#FFA63D"/></svg>';

const KEYS = ['1', '2', '3'];
const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (v: number, max: number): string =>
  `${Math.round(Math.max(0, Math.min(1, v / max)) * 1000) / 10}%`;

export function createHud(parent: HTMLElement): Hud {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="res panel"><span>${ICON_LOG}<b id="res-wood">0</b></span><span>${ICON_STONE}<b id="res-stone">0</b></span></div>
    <div class="phase panel"><b id="phase-label">Day 1</b><small id="phase-time">1:30</small><div class="track"><i id="phase-fill"></i></div></div>
    <div class="bars">
      <div class="bar panel">${ICON_FLAME}<div><span>The Hearth</span><div class="hp hearth"><i id="hearth-hp"></i></div></div></div>
      <div class="bar panel"><span class="av">W</span><div><span>${PLAYER.name}</span><div class="hp"><i id="player-hp"></i></div></div></div>
    </div>
    <div id="hotbar" class="hotbar">${HOTBAR.map(
      (k, n) =>
        `<div class="slot panel" data-kind="${k}"><em>${KEYS[n]}</em><b>${BUILDINGS[k].name}</b><small>${ICON_LOG}${BUILDINGS[k].cost.wood}${
          BUILDINGS[k].cost.stone ? ` ${ICON_STONE}${BUILDINGS[k].cost.stone}` : ''
        }</small></div>`,
    ).join('')}</div>
    <div id="build-tip" class="pop" hidden></div>
    <div id="notice" class="notice" hidden></div>
    <div id="gameover" class="overlay" hidden><div class="panel card"><h1>The Hearth went out</h1><p id="gameover-sub"></p><button id="retry" type="button">Try again</button></div></div>`;
  parent.append(root);
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel) as T;
  const wood = q('#res-wood');
  const stone = q('#res-stone');
  const phaseLabel = q('#phase-label');
  const phaseTime = q('#phase-time');
  const phaseFill = q('#phase-fill');
  const hearthHp = q('#hearth-hp');
  const playerHp = q('#player-hp');
  const slots = [...root.querySelectorAll<HTMLElement>('#hotbar .slot')];
  const tip = q('#build-tip');
  const over = q('#gameover');
  const overSub = q('#gameover-sub');
  const retry = q<HTMLButtonElement>('#retry');
  const noticeEl = q('#notice');
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;
  let onRetry: (() => void) | null = null;
  retry.addEventListener('click', () => onRetry?.());

  return {
    root,
    update(state, playerId) {
      wood.textContent = String(state.resources.wood);
      stone.textContent = String(state.resources.stone);
      phaseLabel.textContent = state.phase === 'day' ? `Day ${state.day}` : `Night ${state.night}`;
      const total = state.phaseEndTick - state.phaseStartTick;
      const left = Math.max(0, state.phaseEndTick - state.tick);
      phaseTime.textContent = fmtTime(left / SIM_TICK_HZ);
      phaseFill.style.width = pct(left, total);
      root.classList.toggle('night', state.phase === 'night');
      const hearth = state.buildings[state.hearthId];
      hearthHp.style.width = pct(hearth?.hp ?? 0, BUILDINGS.hearth.hp);
      const p = state.players[playerId];
      playerHp.style.width = pct(p?.hp ?? 0, PLAYER.maxHp);
      for (const s of slots) {
        const def = BUILDINGS[s.dataset.kind as BuildableKind];
        s.classList.toggle(
          'dim',
          state.resources.wood < def.cost.wood || state.resources.stone < def.cost.stone,
        );
      }
    },
    setBuild(kind) {
      for (const s of slots) s.classList.toggle('on', s.dataset.kind === kind);
    },
    setTip(text, x, y) {
      tip.hidden = text === null;
      if (text === null) return;
      tip.textContent = text;
      if (x !== undefined) tip.style.left = `${x}px`;
      if (y !== undefined) tip.style.top = `${y - 18}px`;
    },
    showGameOver(night, cb) {
      onRetry = cb;
      overSub.textContent = `Night ${night} — the island fell dark.`;
      over.hidden = false;
    },
    notice(text, ms = NOTICE_MS) {
      noticeEl.textContent = text;
      noticeEl.hidden = false;
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        noticeEl.hidden = true;
        noticeTimer = null;
      }, ms);
    },
    hideGameOver() {
      over.hidden = true;
      onRetry = null;
    },
    dispose() {
      if (noticeTimer) clearTimeout(noticeTimer);
      root.remove();
    },
  };
}
