import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Matrix4,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { type Baked, type Part, bake, composeMatrixScaled, jitterGeo, part, smoothBlob } from '../geometry';
import { hash2 } from '../noise';
import { PAL } from '../palette';

export type CreatureKind = 'shadeling' | 'stumpkin' | 'glowbug';
export const SPAWN_GROW_S = 0.4;
/** Glowbug zeminden bu kadar yukarıda süzülür. */
export const GLOWBUG_HOVER_Y = 0.9;

/** Shadeling (kit `makeGolgecik`): topak gövde, parlayan gözler, boynuzlar, kuyruk tutamları. */
export function makeShadeling(seed = 1): Baked {
  const parts: Part[] = [
    part(smoothBlob(0.38, 2, 0.045, seed, 2.4), PAL.shadow, { at: [0, 0.42, 0], scale: [1, 1.12, 0.95] }),
  ];
  for (const sx of [-1, 1]) {
    parts.push(
      part(new SphereGeometry(0.075, 6, 4), PAL.eyeGlow, {
        glow: true,
        intensity: 4,
        at: [sx * 0.13, 0.5, 0.315],
        rot: [0, 0, -sx * 0.4],
        scale: [1, 0.5, 0.5],
      }),
    );
    parts.push(
      part(new ConeGeometry(0.06, 0.22, 7), PAL.shadowDark, {
        at: [sx * 0.2, 0.83, 0.02],
        rot: [0, 0, -sx * 0.5],
      }),
    );
  }
  for (let i = 0; i < 3; i++)
    parts.push(
      part(new ConeGeometry(0.085 - 0.018 * i, 0.38, 7), PAL.shadow, {
        at: [(i - 1) * 0.13, 0.2, -0.28 - (i % 2) * 0.05],
        rot: [-2.15, 0, 0],
      }),
    );
  return bake(parts);
}

/** Stumpkin (kit `makeKutuk`): kütük gövde, yosun, mantar, kor çatlaklar, dal kollar. */
export function makeStumpkin(seed = 2): Baked {
  const parts: Part[] = [
    part(jitterGeo(new CylinderGeometry(0.42, 0.5, 1.0, 9, 3), 0.055, seed, 3), PAL.bark, {
      flat: true,
      at: [0, 0.85, 0],
      colorOf: (_f, ny) => (Math.abs(ny) > 0.9 ? PAL.woodLight : PAL.bark),
    }),
    part(jitterGeo(new IcosahedronGeometry(0.28, 1), 0.06, seed + 4, 3), PAL.moss, {
      flat: true,
      at: [0.12, 1.38, -0.1],
      scale: [1.2, 0.4, 1],
    }),
    part(new CylinderGeometry(0.03, 0.04, 0.12, 8), PAL.cream, { at: [0.43, 1.0, 0.16] }),
    part(new SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), PAL.berry, {
      at: [0.43, 1.05, 0.16],
    }),
    part(new BoxGeometry(0.5, 0.08, 0.12), PAL.barkDark, { at: [0, 1.22, 0.41], rot: [0.25, 0, 0] }),
  ];
  for (const r of [0.24, 0.12])
    parts.push(
      part(new TorusGeometry(r, 0.014, 4, 12), PAL.woodDark, { at: [0, 1.36, 0], rot: [Math.PI / 2, 0, 0] }),
    );
  const cracks: [number, number, number, number][] = [
    [-0.13, 0.86, 0.46, 0.5],
    [0.07, 0.66, 0.475, -0.35],
    [0.2, 0.92, 0.43, 0.2],
  ];
  for (const [x, y, z, r] of cracks)
    parts.push(
      part(new BoxGeometry(0.045, 0.3, 0.03), PAL.ember, {
        glow: true,
        intensity: 3.2,
        at: [x, y, z],
        rot: [0, 0, r],
      }),
    );
  for (const sx of [-1, 1]) {
    parts.push(
      part(new SphereGeometry(0.065, 8, 6), PAL.stumpkinEye, {
        glow: true,
        intensity: 4,
        at: [sx * 0.15, 1.12, 0.42],
        scale: [1, 0.7, 0.5],
      }),
    );
    // kol pivotu (sx*0.45, 1.05, 0), rot z sx*0.45; parçalar pivot-yerel
    const arm = (g: Parameters<typeof part>[0], color: number, at: [number, number, number], rz = 0) => {
      const m = new Matrix4().makeRotationZ(rz).setPosition(at[0], at[1], at[2]);
      g.applyMatrix4(m);
      parts.push(
        part(g, color, { at: [sx * 0.45, 1.05, 0], rot: [0, 0, sx * 0.45], flat: color === PAL.leaf }),
      );
    };
    arm(new CylinderGeometry(0.06, 0.09, 0.7, 6), PAL.bark, [0, -0.35, 0]);
    arm(new CylinderGeometry(0.025, 0.035, 0.25, 5), PAL.bark, [sx * 0.08, -0.5, 0], sx * 0.8);
    arm(jitterGeo(new IcosahedronGeometry(0.11, 0), 0.03, seed + sx, 4), PAL.leaf, [sx * 0.17, -0.58, 0]);
    parts.push(part(new CylinderGeometry(0.14, 0.17, 0.36, 7), PAL.bark, { at: [sx * 0.2, 0.18, 0] }));
  }
  return bake(parts);
}

/** Glowbug (kit `makeFenerbocegi`): kabuk, kafa, antenler, parlayan karın, kanatlar (opak). Gövde yerel y=0; süzülme instance'ta. */
export function makeGlowbug(seed = 3): Baked {
  const parts: Part[] = [
    part(new SphereGeometry(0.22, 10, 7), PAL.beetle, { scale: [0.95, 0.75, 1.25] }),
    part(new BoxGeometry(0.014, 0.02, 0.5), PAL.beetleDark, { at: [0, 0.165, 0] }),
    part(new SphereGeometry(0.12, 8, 6), PAL.beetleDark, { at: [0, -0.02, 0.3] }),
    part(new SphereGeometry(0.17, 10, 7), PAL.beetleGlow, {
      glow: true,
      intensity: 4.5,
      at: [0, -0.04, -0.29],
      scale: [1, 0.85, 1.25],
    }),
  ];
  for (const z of [-0.22, -0.33])
    parts.push(
      part(new TorusGeometry(0.15, 0.012, 4, 12), PAL.beetleDark, { at: [0, -0.04, z], scale: [1, 0.85, 1] }),
    );
  for (const sx of [-1, 1]) {
    parts.push(
      part(new SphereGeometry(0.028, 6, 4), 0xffffff, {
        glow: true,
        intensity: 0.6,
        at: [sx * 0.06, 0.02, 0.4],
      }),
    );
    parts.push(
      part(new CylinderGeometry(0.007, 0.007, 0.26, 4), PAL.beetleDark, {
        at: [sx * 0.06, 0.12, 0.42],
        rot: [0.75, 0, -sx * 0.35],
      }),
    );
    parts.push(
      part(new SphereGeometry(0.025, 6, 4), PAL.beetleGlow, {
        glow: true,
        intensity: 3,
        at: [sx * 0.1, 0.22, 0.51],
      }),
    );
    for (let k = 0; k < 3; k++)
      parts.push(
        part(new CylinderGeometry(0.012, 0.008, 0.26, 4), PAL.beetleDark, {
          at: [sx * 0.16, -0.11, -0.08 + k * 0.13],
          rot: [0, 0, sx * 0.85],
        }),
      );
    for (const face of [0, Math.PI]) {
      const w = new CircleGeometry(0.22, 12);
      w.rotateX(face === 0 ? -Math.PI / 2 : Math.PI / 2);
      w.scale(0.45, 1, 1);
      w.translate(sx * 0.12, 0, -0.13);
      parts.push(part(w, PAL.wing, { at: [sx * 0.05, 0.14, 0.05], rot: [0, 0, sx * 0.35] }));
    }
  }
  const _ = seed; // varyasyon instance ölçeğiyle
  void _;
  return bake(parts);
}

export function creatureScale(kind: CreatureKind, seed: number): number {
  return kind === 'shadeling' ? 0.9 + hash2(seed, 11, 2) * 0.25 : 1;
}

/**
 * Kit animasyonlarının instance matrisi karşılığı:
 * Shadeling zıplar + ezilir, Stumpkin sallanır, Glowbug süzülür. Doğarken SPAWN_GROW_S içinde büyür.
 */
export function creatureInstanceMatrix(
  kind: CreatureKind,
  x: number,
  groundY: number,
  z: number,
  yaw: number,
  t: number,
  seed: number,
  ageS: number,
  out: Matrix4,
): Matrix4 {
  const grow = Math.min(1, Math.max(0, ageS / SPAWN_GROW_S));
  const base = creatureScale(kind, seed) * grow;
  let y = groundY;
  let sx = 1;
  let sy = 1;
  let sz = 1;
  let tilt = 0;
  if (kind === 'shadeling') {
    const p = (t * 1.6 + seed * 0.37) % 1;
    const hop = Math.sin(p * Math.PI);
    y += hop * 0.35;
    const k = p < 0.1 || p > 0.9 ? 0.82 : 1 + hop * 0.08;
    sx = sz = 1 / Math.sqrt(k);
    sy = k;
  } else if (kind === 'stumpkin') {
    const w = Math.sin(t * 2.6 + seed);
    tilt = w * 0.07;
    y += Math.abs(w) * 0.04;
  } else {
    y += GLOWBUG_HOVER_Y + Math.sin(t * 3 + seed) * 0.1;
    tilt = Math.sin(t * 2 + seed) * 0.1;
  }
  return composeMatrixScaled(x, y, z, yaw, sx * base, sy * base, sz * base, tilt, out);
}
