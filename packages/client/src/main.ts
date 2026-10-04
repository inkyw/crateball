import './style.css';
import { PROTOCOL_VERSION } from '@gg/protocol';
import { startGame } from './game';
import { connect, type NetStatus } from './net';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const banner = document.querySelector<HTMLDivElement>('#banner');
if (!canvas || !banner) throw new Error('index.html eksik: #game veya #banner yok');

const seedParam = new URLSearchParams(location.search).get('seed');
const seed = seedParam !== null && seedParam !== '' ? Number(seedParam) >>> 0 : Date.now() % 1_000_000;
const game = startGame({ canvas, hudParent: document.body, seed });
const resize = () => game.renderer.resize(innerWidth, innerHeight, devicePixelRatio);
addEventListener('resize', resize);
resize();

const NET_TEXT: Record<NetStatus, string> = {
  connecting: 'connecting…',
  open: 'connected',
  closed: 'offline — retrying',
  version_mismatch: 'version mismatch',
};
// M1: sunucu oyun çalıştırmaz; bağlantı yalnızca dev log + sürüm kontrolü için (M2'de NetSession).
const conn = connect({
  url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
  onStatus: (s) => {
    if (s !== 'version_mismatch') return;
    banner.hidden = false;
    banner.textContent = 'The game was updated.';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Reload page';
    btn.onclick = () => location.reload();
    banner.append(btn);
  },
});

function getState() {
  const s = game.stats;
  return {
    frame: s.frame,
    net: { status: conn.status, clientId: conn.clientId, protocolVersion: PROTOCOL_VERSION },
    render: {
      fps: s.fps,
      frameMs: s.frameMs,
      calls: s.calls,
      triangles: s.triangles,
      night: game.renderer.night,
      effects: game.renderer.effects,
      memory: game.renderer.memory,
    },
    sim: game.summary(),
  };
}

let afterFrame: (() => void) | null = null;
function loop(now: number) {
  game.frame(now);
  afterFrame?.();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Dev araçları: prod build'de bu dal tamamen silinir (import.meta.env.DEV === false).
if (import.meta.env.DEV) {
  const dev = await import('@gg/devtools');
  dev.installLogBridge({ endpoint: '/__log', clientId: `c-${Math.random().toString(36).slice(2, 8)}` });
  const bridge = dev.createDebugBridge(getState);
  bridge.register('netStatus', () => NET_TEXT[conn.status]);
  window.__game = bridge;
  const overlay = dev.createDebugOverlay(document.body);
  if (new URLSearchParams(location.search).has('debug')) overlay.toggle(true);
  addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      overlay.toggle();
    }
  });
  afterFrame = () => {
    if (game.stats.frame % 10 === 0) overlay.update({ ...game.stats, net: NET_TEXT[conn.status] });
  };
  console.info(`[before-nightfall] dev tools ready: window.__game, F1 debug panel (seed ${seed})`);
}
