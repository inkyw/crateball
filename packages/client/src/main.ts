import './style.css';
import { PROTOCOL_VERSION } from '@gg/protocol';
import { connect, type NetStatus } from './net';
import { createScene } from './scene';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const banner = document.querySelector<HTMLDivElement>('#banner');
if (!canvas || !banner) throw new Error('index.html eksik: #game veya #banner yok');

const scene = createScene(canvas);
const resize = () => scene.resize(innerWidth, innerHeight, devicePixelRatio);
addEventListener('resize', resize);
resize();

const NET_TEXT: Record<NetStatus, string> = {
  connecting: 'bağlanıyor…',
  open: 'bağlı',
  closed: 'bağlantı yok — yeniden deneniyor',
  version_mismatch: 'sürüm uyuşmuyor',
};

const conn = connect({
  url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
  onStatus: (s) => {
    if (s !== 'version_mismatch') return;
    banner.hidden = false;
    banner.textContent = 'Oyun güncellendi.';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Sayfayı yenile';
    btn.onclick = () => location.reload();
    banner.append(btn);
  },
});

const stats = { frame: 0, fps: 0, frameMs: 0, calls: 0, triangles: 0 };
function getState() {
  return {
    frame: stats.frame,
    net: { status: conn.status, clientId: conn.clientId, protocolVersion: PROTOCOL_VERSION },
    render: { fps: stats.fps, frameMs: stats.frameMs, calls: stats.calls, triangles: stats.triangles },
  };
}

let afterFrame: (() => void) | null = null;
let last = performance.now();
let acc = 0;
let frames = 0;
function loop(now: number) {
  const t0 = performance.now();
  const r = scene.render();
  stats.frame++;
  stats.calls = r.calls;
  stats.triangles = r.triangles;
  stats.frameMs = performance.now() - t0;
  acc += now - last;
  frames++;
  last = now;
  if (acc >= 500) {
    stats.fps = Math.round((frames * 1000) / acc);
    acc = 0;
    frames = 0;
  }
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
    if (stats.frame % 10 === 0) overlay.update({ ...stats, net: NET_TEXT[conn.status] });
  };
  console.info('[gece-gelmeden] dev araçları hazır: window.__game, F1 debug paneli');
}
