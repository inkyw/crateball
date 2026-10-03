import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  type Texture,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { type Baked, GLOW_MATERIAL, type Part, bake, bakedToGroup, jitterGeo, part } from '../geometry';
import { rng, vnoise } from '../noise';
import { PAL } from '../palette';
import { rockPart } from './nature';

/** +x, -x, +z, -z — sim DIRS ile aynı sıra (maske bitleri). */
export const FENCE_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export const FENCE_VARIANTS = 16;

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3(1, 1, 1);
/** İç içe grup dönüşümünü geometriye uygular (önce yerel, sonra `part` ile dış). */
function local(
  geo: BufferGeometry,
  at: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
): BufferGeometry {
  _q.setFromEuler(new Euler(...rot));
  return geo.applyMatrix4(_m.compose(_p.set(...at), _q, _s));
}

/** Çit hücresi: orta direk + komşu maskesine göre raylar (kit `makeFenceCell`). Maske 0 → x ekseninde kısa kollar. */
export function makeFenceCell(mask: number): Baked {
  const R = rng(mask + 1);
  const parts: Part[] = [
    part(new RoundedBoxGeometry(0.15, 0.85, 0.15, 1, 0.03), PAL.wood, {
      at: [0, 0.42, 0],
      rot: [0, (R() - 0.5) * 0.3, 0],
    }),
    part(new ConeGeometry(0.105, 0.18, 4), PAL.wood, { at: [0, 0.93, 0], rot: [0, Math.PI / 4, 0] }),
    part(new TorusGeometry(0.095, 0.022, 6, 14), PAL.woodDark, {
      at: [0, 0.62, 0],
      rot: [Math.PI / 2, 0, 0],
    }),
  ];
  const arms = mask ? FENCE_DIRS.filter((_, b) => mask & (1 << b)) : [FENCE_DIRS[0]!, FENCE_DIRS[1]!];
  const len = mask ? 0.52 : 0.3;
  for (const [dx, dz] of arms)
    for (const y of [0.32, 0.62]) {
      // Raylar düz kutu (12 üçgen): 16 varyant × instancing için bütçe. RoundedBox(…, 2) 300 üçgen olurdu.
      const geo = dx ? new BoxGeometry(len, 0.13, 0.06) : new BoxGeometry(0.06, 0.13, len);
      parts.push(
        part(geo, y > 0.5 ? PAL.woodLight : PAL.wood, {
          at: [(dx * len) / 2, y + (R() - 0.5) * 0.03, (dz * len) / 2],
        }),
      );
    }
  return bake(parts);
}

/** Ok kulesi (kit `makeTower`); bayrak dalgalanması instancing yüzünden yok. */
export function makeTower(flagColor: number = PAL.p2): Baked {
  const H = 2.2;
  const W = 0.62;
  const parts: Part[] = [];
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    parts.push(
      part(new RoundedBoxGeometry(0.2, H + 0.2, 0.2, 1, 0.04), PAL.wood, {
        at: [sx! * W, H / 2, sz! * W],
        rot: [sz! * 0.04, 0, -sx! * 0.04],
      }),
    );
    parts.push(rockPart(70 + sx! * 3 + sz!, 0.2, true, [sx! * (W + 0.2), 0.04, sz! * (W + 0.15)]));
    parts.push(part(new BoxGeometry(0.1, 1.05, 0.1), PAL.wood, { at: [sx! * 0.78, H + 0.55, sz! * 0.78] }));
  }
  for (let side = 0; side < 4; side++) {
    const ry = (side * Math.PI) / 2;
    for (const s of [-1, 1])
      parts.push(
        part(local(new BoxGeometry(0.08, 1.75, 0.06), [0, 1.05, W + 0.04], [0, 0, s * 0.6]), PAL.woodDark, {
          rot: [0, ry, 0],
        }),
      );
    parts.push(
      part(local(new BoxGeometry(1.62, 0.07, 0.07), [0, H + 0.42, 0.8]), PAL.woodDark, { rot: [0, ry, 0] }),
    );
  }
  parts.push(part(new RoundedBoxGeometry(1.75, 0.2, 1.75, 1, 0.05), PAL.woodLight, { at: [0, H, 0] }));
  parts.push(
    part(new ConeGeometry(1.4, 0.95, 4), PAL.roof, {
      flat: true,
      at: [0, H + 1.5, 0],
      rot: [0, Math.PI / 4, 0],
    }),
  );
  parts.push(part(new SphereGeometry(0.09, 8, 6), PAL.gold, { at: [0, H + 2.0, 0] }));
  parts.push(part(new CylinderGeometry(0.022, 0.022, 0.75, 6), PAL.woodDark, { at: [0, H + 2.35, 0] }));
  for (const face of [0, Math.PI]) {
    const flag = new PlaneGeometry(0.5, 0.3, 4, 1);
    flag.translate(0.25, 0, 0);
    parts.push(part(flag, flagColor, { at: [0.02, H + 2.55, 0], rot: [0, face, 0] }));
  }
  // balista
  const bal: [BufferGeometry, number, [number, number, number], [number, number, number]][] = [
    [new RoundedBoxGeometry(0.22, 0.25, 0.22, 1, 0.04), PAL.woodDark, [0, 0.12, 0], [0, 0, 0]],
    [new BoxGeometry(0.14, 0.1, 0.7), PAL.wood, [0, 0.3, 0.1], [0, 0, 0]],
    [
      new TorusGeometry(0.32, 0.03, 5, 12, Math.PI),
      PAL.woodDark,
      [0, 0.32, 0.38],
      [-Math.PI / 2, 0, Math.PI],
    ],
    [new CylinderGeometry(0.015, 0.015, 0.8, 5), PAL.woodLight, [0, 0.36, 0.15], [Math.PI / 2, 0, 0]],
  ];
  for (const [geo, color, at, rot] of bal)
    parts.push(part(local(geo, at, rot), color, { at: [0, H + 0.2, 0], rot: [0, Math.PI / 4, 0] }));
  // merdiven
  for (const sx of [-1, 1])
    parts.push(
      part(local(new BoxGeometry(0.06, H + 0.1, 0.06), [sx * 0.18, H / 2, 0]), PAL.woodDark, {
        at: [0, 0, W + 0.22],
        rot: [-0.12, 0, 0],
      }),
    );
  for (let i = 0; i < 6; i++)
    parts.push(
      part(local(new BoxGeometry(0.42, 0.04, 0.05), [0, 0.3 + i * 0.32, 0]), PAL.woodLight, {
        at: [0, 0, W + 0.22],
        rot: [-0.12, 0, 0],
      }),
    );
  return bake(parts);
}

/** Fenerin lambası direğe göre bu kadar kaymıştır; zemin halesi de burada. */
export const LANTERN_LAMP_OFFSET = { x: 0.42, z: 0 } as const;
export const LANTERN_POOL = { size: 4.2, color: PAL.glowWarm, base: 0.55 } as const;
export const HEARTH_POOL = { size: 8, color: PAL.hearthPool, base: 0.75 } as const;
export const GLOWBUG_POOL = { size: 1.8, color: PAL.beetleGlow, base: 0.5 } as const;
export const LANTERN_GLASS_INTENSITY = 2.0;

/** Fener (kit `makeLantern`): direk, kol, lamba; cam glow geometrisinde. Gerçek ışık yok (sahte havuz). */
export function makeLantern(): Baked {
  const L: [number, number, number] = [LANTERN_LAMP_OFFSET.x, 1.3, LANTERN_LAMP_OFFSET.z];
  const parts: Part[] = [
    part(new RoundedBoxGeometry(0.16, 1.7, 0.16, 1, 0.03), PAL.woodDark, { at: [0, 0.85, 0] }),
    part(new BoxGeometry(0.58, 0.09, 0.09), PAL.woodDark, { at: [0.22, 1.64, 0] }),
    part(new CylinderGeometry(0.012, 0.012, 0.14, 4), PAL.metal, { at: [0.42, 1.55, 0] }),
    part(new BoxGeometry(0.19, 0.25, 0.19), PAL.glow, {
      glow: true,
      intensity: LANTERN_GLASS_INTENSITY,
      at: L,
    }),
    part(new BoxGeometry(0.29, 0.045, 0.29), PAL.metal, { at: [L[0], L[1] - 0.16, L[2]] }),
    part(new ConeGeometry(0.23, 0.15, 4), PAL.metal, {
      at: [L[0], L[1] + 0.22, L[2]],
      rot: [0, Math.PI / 4, 0],
    }),
    part(new TorusGeometry(0.035, 0.012, 5, 10), PAL.metal, { at: [L[0], L[1] + 0.32, L[2]] }),
  ];
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    parts.push(
      part(new BoxGeometry(0.03, 0.3, 0.03), PAL.metal, {
        at: [L[0] + sx! * 0.105, L[1], L[2] + sz! * 0.105],
      }),
    );
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    parts.push(rockPart(80 + i, 0.16, true, [Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2]));
  }
  return bake(parts);
}

export interface HearthModel {
  group: Group;
  light: PointLight;
  anim(t: number, dt: number, night: number): void;
  /** Sahip olunan geometriler (opak, köz, alev, kıvılcım) ve kıvılcım malzemesi bırakılır; paylaşılan malzemeler kalır. */
  dispose(): void;
}

/** The Hearth (kit `makeOcak`): taş halka + kül + kütükler + közler (bake), alevler (tek glow mesh), kıvılcımlar, nokta ışığı. */
export function makeHearth(glowTex: Texture | null): HearthModel {
  const parts: Part[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const r = rockPart(40 + i, 0.24, false);
    r.geometry.applyMatrix4(
      _m.compose(
        _p.set(Math.cos(a) * 0.8, 0.06, Math.sin(a) * 0.8),
        _q.setFromAxisAngle(new Vector3(0, 1, 0), a),
        _s,
      ),
    );
    parts.push(r);
  }
  parts.push(part(new CylinderGeometry(0.7, 0.72, 0.05, 20), PAL.ash, { at: [0, 0.03, 0] }));
  for (let i = 0; i < 5; i++) {
    const geo = local(new CylinderGeometry(0.075, 0.075 * 1.05, 0.85, 8), [0.24, 0.3, 0], [0, 0, 0.55]);
    parts.push(
      part(geo, PAL.charcoal, {
        flat: true,
        rot: [0, (i / 5) * Math.PI * 2 + 0.3, 0],
        colorOf: (_f, ny) => (Math.abs(ny) > 0.9 ? PAL.woodDark : PAL.charcoal),
      }),
    );
  }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    parts.push(
      part(new IcosahedronGeometry(0.06, 0), PAL.ember, {
        glow: true,
        intensity: 3,
        flat: true,
        at: [Math.cos(a) * 0.4, 0.07, Math.sin(a) * 0.4],
      }),
    );
  }
  const group = bakedToGroup(bake(parts));

  const flameParts: Part[] = [];
  const flames: [number, number, number, number][] = [
    [0.38, 1.05, PAL.flameLow, 1.3],
    [0.27, 0.85, PAL.flameMid, 1.6],
    [0.15, 0.6, PAL.flameHigh, 2.2],
  ];
  flames.forEach(([r, h, c, ei], i) =>
    flameParts.push(
      part(jitterGeo(new ConeGeometry(r, h, 7, 2), 0.04, 90 + i, 3), c, {
        glow: true,
        intensity: ei,
        at: [0, h / 2, 0],
      }),
    ),
  );
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    flameParts.push(
      part(new ConeGeometry(0.1, 0.45, 5), PAL.flameMid, {
        glow: true,
        intensity: 1.6,
        at: [Math.cos(a) * 0.22, 0.25, Math.sin(a) * 0.22],
      }),
    );
  }
  const flameGeo = bake(flameParts).glow as BufferGeometry;
  const flameMesh = new Mesh(flameGeo, GLOW_MATERIAL);
  flameMesh.position.y = 0.12;
  group.add(flameMesh);

  const light = new PointLight(PAL.hearthLight, 2, 13, 1.5);
  light.position.y = 0.9;
  group.add(light);

  const N = 40;
  const sp = new Float32Array(N * 3);
  const R = rng(7);
  const life = new Float32Array(N).map(() => R());
  const sg = new BufferGeometry();
  sg.setAttribute('position', new BufferAttribute(sp, 3));
  const sparks = new Points(
    sg,
    new PointsMaterial({
      color: PAL.sparks,
      map: glowTex,
      size: 7,
      sizeAttenuation: false,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  sparks.frustumCulled = false;
  group.add(sparks);

  return {
    group,
    light,
    anim(t, dt, night) {
      const k = 1 + Math.sin(t * 9) * 0.1 + (vnoise(t * 6, 0, 3) - 0.5) * 0.18;
      flameMesh.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k));
      flameMesh.rotation.y = t * 0.8;
      light.intensity = (2 + night * 9) * (0.85 + vnoise(t * 8, 1, 4) * 0.3);
      for (let i = 0; i < N; i++) {
        life[i] = (life[i] as number) + dt * (0.5 + (i % 5) * 0.08);
        if ((life[i] as number) > 1) life[i] = 0;
        const a = i * 2.39996;
        const r = 0.12 + (life[i] as number) * 0.35;
        sp[i * 3] = Math.cos(a + t * 0.6) * r;
        sp[i * 3 + 1] = 0.4 + (life[i] as number) * 2.4;
        sp[i * 3 + 2] = Math.sin(a + t * 0.6) * r;
      }
      sg.getAttribute('position').needsUpdate = true;
    },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => {
        if (o instanceof Mesh || o instanceof Points) o.geometry.dispose();
      });
      sparks.material.dispose();
    },
  };
}

/** Kule oku: gövde + uç + tüy; +z yönüne bakar. */
export function makeArrow(): Baked {
  return bake([
    part(new CylinderGeometry(0.02, 0.02, 0.6, 4), PAL.woodLight, { rot: [Math.PI / 2, 0, 0] }),
    part(new ConeGeometry(0.04, 0.1, 4), PAL.metal, { at: [0, 0, 0.33], rot: [Math.PI / 2, 0, 0] }),
    part(new BoxGeometry(0.06, 0.01, 0.1), PAL.p1, { at: [0, 0, -0.27] }),
  ]);
}
