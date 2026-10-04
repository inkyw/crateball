import { Color, DirectionalLight, HemisphereLight, type Scene, Vector3 } from 'three';
import { lerp } from './noise';

export interface TimeKey {
  t: number;
  sky: number;
  lc: number;
  li: number;
  hs: number;
  hg: number;
  hi: number;
  n: number;
}
/** Kit `KEYS` aynen: gün saati (0..1) → gök, güneş/ay, yarım küre, gece oranı. */
export const TIME_KEYS: readonly TimeKey[] = [
  { t: 0.0, sky: 0x0d1330, lc: 0x9fb4ff, li: 0.9, hs: 0x3a4a8a, hg: 0x1a1430, hi: 0.85, n: 1 },
  { t: 0.2, sky: 0x1a1f45, lc: 0x9fb4ff, li: 0.8, hs: 0x3a4a8a, hg: 0x1a1430, hi: 0.8, n: 1 },
  { t: 0.225, sky: 0x4a3a6a, lc: 0xffa070, li: 0.15, hs: 0x6a5a8a, hg: 0x2a2030, hi: 0.6, n: 0.8 },
  { t: 0.26, sky: 0xf4a27a, lc: 0xffb27a, li: 1.3, hs: 0xf0b9a0, hg: 0x5a4a60, hi: 0.9, n: 0.35 },
  { t: 0.33, sky: 0x9fd4f0, lc: 0xffe2b8, li: 2.6, hs: 0xbfe3ff, hg: 0x7a6a50, hi: 1.15, n: 0 },
  { t: 0.5, sky: 0x8fd0f2, lc: 0xfff4e0, li: 3.0, hs: 0xcdebff, hg: 0x8a7a5a, hi: 1.25, n: 0 },
  { t: 0.67, sky: 0x9fcbe8, lc: 0xffe0b0, li: 2.6, hs: 0xc5e2f5, hg: 0x7a6a50, hi: 1.15, n: 0 },
  { t: 0.745, sky: 0xf08a6a, lc: 0xff9a5a, li: 1.4, hs: 0xe89a90, hg: 0x4a3a55, hi: 0.85, n: 0.4 },
  { t: 0.775, sky: 0x4a3a6a, lc: 0xff8a60, li: 0.15, hs: 0x5a4a7a, hg: 0x2a2030, hi: 0.6, n: 0.8 },
  { t: 0.81, sky: 0x1a1f45, lc: 0x9fb4ff, li: 0.8, hs: 0x3a4a8a, hg: 0x1a1430, hi: 0.8, n: 1 },
  { t: 1.0, sky: 0x0d1330, lc: 0x9fb4ff, li: 0.9, hs: 0x3a4a8a, hg: 0x1a1430, hi: 0.85, n: 1 },
];

export interface KeySample {
  sky: Color;
  sunColor: Color;
  sunIntensity: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  night: number;
}
const _b = new Color();
export function sampleKeys(t: number, out?: KeySample): KeySample {
  const o = out ?? {
    sky: new Color(),
    sunColor: new Color(),
    sunIntensity: 0,
    hemiSky: new Color(),
    hemiGround: new Color(),
    hemiIntensity: 0,
    night: 0,
  };
  const tt = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < TIME_KEYS.length - 2 && tt >= TIME_KEYS[i + 1]!.t) i++;
  const k0 = TIME_KEYS[i]!;
  const k1 = TIME_KEYS[i + 1]!;
  const f = (tt - k0.t) / (k1.t - k0.t);
  const mix = (a: number, b: number, c: Color) => c.setHex(a).lerp(_b.setHex(b), f);
  mix(k0.sky, k1.sky, o.sky);
  mix(k0.lc, k1.lc, o.sunColor);
  mix(k0.hs, k1.hs, o.hemiSky);
  mix(k0.hg, k1.hg, o.hemiGround);
  o.sunIntensity = lerp(k0.li, k1.li, f);
  o.hemiIntensity = lerp(k0.hi, k1.hi, f);
  o.night = lerp(k0.n, k1.n, f);
  return o;
}

/** Gündüz fazı gün saatinin bu aralığına eşlenir: tam gün ışığında başlar (n ≈ 0.05), batım yaklaşırken biter. */
const DAY_TOD_START = 0.32;
const DAY_TOD_END = 0.75;
/** Sim fazı + ilerleme (0..1) → gün saati. Gündüz 0.32→0.75; gece 0.75→1.32≡0.32 (şafak ve alacakaranlık gece fazının uçlarında görünür). */
export function todFromPhase(phase: 'day' | 'night', progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  if (phase === 'day') return DAY_TOD_START + (DAY_TOD_END - DAY_TOD_START) * p;
  return (DAY_TOD_END + (1 + DAY_TOD_START - DAY_TOD_END) * p) % 1;
}

export interface LightingOptions {
  shadowMapSize: number;
  /** Gölge kamerasının yarı genişliği (odak etrafında). */
  shadowExtent: number;
}
export interface Lighting {
  sun: DirectionalLight;
  hemi: HemisphereLight;
  /** Işıkları gün saatine göre ayarlar; güneş odak noktasını hedefler. */
  apply(t: number, focus: Vector3): KeySample;
}
const _dir = new Vector3();
export function createLighting(scene: Scene, o: LightingOptions): Lighting {
  const hemi = new HemisphereLight(0xcdebff, 0x8a7a5a, 1.2);
  const sun = new DirectionalLight(0xfff4e0, 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(o.shadowMapSize, o.shadowMapSize);
  Object.assign(sun.shadow.camera, {
    left: -o.shadowExtent,
    right: o.shadowExtent,
    top: o.shadowExtent,
    bottom: -o.shadowExtent,
    near: 1,
    far: 140,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  scene.add(hemi, sun, sun.target);
  const sample = sampleKeys(0.5);
  return {
    sun,
    hemi,
    apply(t, focus) {
      sampleKeys(t, sample);
      if (scene.background instanceof Color) scene.background.copy(sample.sky);
      else scene.background = sample.sky.clone();
      sun.color.copy(sample.sunColor);
      sun.intensity = sample.sunIntensity;
      hemi.color.copy(sample.hemiSky);
      hemi.groundColor.copy(sample.hemiGround);
      hemi.intensity = sample.hemiIntensity;
      const day = t > 0.225 && t < 0.775;
      if (day) {
        const a = ((t - 0.225) / 0.55) * Math.PI;
        _dir.set(Math.cos(a) * 0.85, Math.max(Math.sin(a), 0.2), 0.5);
      } else {
        const tt = (t + 0.5) % 1;
        const a = ((tt - 0.225) / 0.55) * Math.PI;
        _dir.set(-Math.cos(a) * 0.6, Math.max(Math.sin(a), 0.45), -0.45);
      }
      sun.position.copy(focus).addScaledVector(_dir.normalize(), 50);
      sun.target.position.copy(focus);
      sun.target.updateMatrixWorld();
      return sample;
    },
  };
}
