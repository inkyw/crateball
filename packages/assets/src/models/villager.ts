import {
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { type Baked, GLOW_MATERIAL, type Part, SHARED_MATERIAL, bake, part } from '../geometry';
import { lerp, smoothstep } from '../noise';
import { PAL } from '../palette';

export type VillagerState = 'idle' | 'walk' | 'chop';
export type HatKind = 'beanie' | 'beanie2' | 'straw' | 'bandana';
export interface VillagerOptions {
  color?: number;
  hat?: HatKind;
  seed?: number;
}
export interface VillagerModel {
  group: Group;
  setState(s: VillagerState): void;
  /** t: saniye; chopPhase: 0..1 (vuruş döngüsü içindeki konum; sadece 'chop' durumunda kullanılır). */
  anim(t: number, chopPhase: number): void;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _one = new Vector3(1, 1, 1);
function local(
  geo: BufferGeometry,
  at: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
): BufferGeometry {
  return geo.applyMatrix4(_m.compose(new Vector3(...at), _q.setFromEuler(new Euler(...rot)), _one));
}
function meshes(baked: Baked, name: string): Mesh[] {
  const out: Mesh[] = [];
  if (baked.opaque) {
    const m = new Mesh(baked.opaque, undefined);
    m.name = name;
    out.push(m);
  }
  if (baked.glow) {
    const m = new Mesh(baked.glow, undefined);
    m.name = `${name}Glow`;
    out.push(m);
  }
  return out;
}

/** Woodcutter (kit `makeVillager`): oyuncak oranları, kemiksiz parça animasyonu. Parçalar pivot başına bake edilir. */
export function makeVillager({
  color = PAL.p1,
  hat = 'beanie',
  seed = 1,
}: VillagerOptions = {}): VillagerModel {
  const cS = new Color(color);
  const shirt = cS.getHex();
  const dark = cS.clone().multiplyScalar(0.62).getHex();
  const light = cS.clone().lerp(new Color(0xffffff), 0.45).getHex();
  const group = new Group();
  const root = new Group();
  group.add(root);

  // gövde (statik)
  const bodyParts: Part[] = [
    part(new CapsuleGeometry(0.25, 0.16, 8, 20), shirt, { at: [0, 0.62, 0], scale: [1, 1, 0.86] }),
    part(new TorusGeometry(0.232, 0.032, 8, 28), PAL.leather, { at: [0, 0.45, 0], rot: [Math.PI / 2, 0, 0] }),
    part(new RoundedBoxGeometry(0.085, 0.075, 0.03, 1, 0.012), PAL.gold, { at: [0, 0.45, 0.205] }),
    part(new TorusGeometry(0.17, 0.055, 8, 22), dark, { at: [0, 0.97, 0], rot: [Math.PI / 2, 0, 0] }),
    part(new RoundedBoxGeometry(0.36, 0.42, 0.2, 3, 0.07), PAL.leather, { at: [0, 0.66, -0.26] }),
    part(new RoundedBoxGeometry(0.37, 0.14, 0.21, 2, 0.05), PAL.boot, { at: [0, 0.82, -0.262] }),
    part(new CylinderGeometry(0.085, 0.085, 0.46, 14), PAL.bedroll, {
      at: [0, 0.93, -0.28],
      rot: [0, 0, Math.PI / 2],
    }),
  ];
  const [body] = meshes(bake(bodyParts), 'body');
  root.add(body!);

  // bacaklar
  const legs: Group[] = [];
  for (const sx of [-1, 1]) {
    const pv = new Group();
    pv.name = sx < 0 ? 'legL' : 'legR';
    pv.position.set(0.11 * sx, 0.36, 0);
    pv.add(
      ...meshes(
        bake([
          part(new CapsuleGeometry(0.085, 0.14, 6, 12), PAL.pants, { at: [0, -0.15, 0] }),
          part(new RoundedBoxGeometry(0.17, 0.11, 0.24, 2, 0.045), PAL.boot, { at: [0, -0.3, 0.03] }),
        ]),
        'leg',
      ),
    );
    root.add(pv);
    legs.push(pv);
  }

  // kollar (armR baltayı tutar)
  const arms: Group[] = [];
  for (const sx of [-1, 1]) {
    const pv = new Group();
    pv.name = sx < 0 ? 'armR' : 'armL';
    pv.position.set(0.3 * sx, 0.88, 0);
    pv.rotation.z = sx * 0.12;
    const parts: Part[] = [
      part(new CapsuleGeometry(0.07, 0.2, 6, 12), shirt, { at: [0, -0.15, 0] }),
      part(new SphereGeometry(0.076, 10, 8), PAL.skin, { at: [0, -0.32, 0] }),
    ];
    if (sx < 0) {
      const axeAt: [number, number, number] = [0, -0.33, 0.03];
      const axeRot: [number, number, number] = [(Math.PI / 2) * 0.85, 0, 0];
      parts.push(
        part(local(new CylinderGeometry(0.024, 0.028, 0.58, 8), [0, 0.12, 0]), PAL.wood, {
          at: axeAt,
          rot: axeRot,
        }),
      );
      const sh = new Shape();
      sh.moveTo(0, 0.06);
      sh.quadraticCurveTo(0.12, 0.08, 0.2, 0.14);
      sh.lineTo(0.21, -0.14);
      sh.quadraticCurveTo(0.12, -0.09, 0, -0.06);
      sh.closePath();
      const blade = new ExtrudeGeometry(sh, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 2,
        curveSegments: 6,
      });
      blade.translate(0, 0, -0.0175);
      blade.rotateY(-Math.PI / 2);
      parts.push(part(local(blade, [0, 0.33, 0.02]), PAL.axeBlade, { at: axeAt, rot: axeRot }));
    }
    pv.add(...meshes(bake(parts), 'arm'));
    root.add(pv);
    arms.push(pv);
  }

  // kafa
  const head = new Group();
  head.name = 'head';
  head.position.y = 1.2;
  const hp: Part[] = [
    part(new SphereGeometry(0.28, 16, 12), PAL.skin),
    part(new SphereGeometry(0.034, 8, 6), PAL.skinDark, { at: [0, -0.03, 0.28] }),
  ];
  for (const sx of [-1, 1]) {
    hp.push(
      part(new SphereGeometry(0.038, 8, 6), PAL.eye, { at: [sx * 0.1, 0.02, 0.252], scale: [1, 1.3, 0.6] }),
    );
    hp.push(
      part(new SphereGeometry(0.013, 6, 4), 0xffffff, {
        glow: true,
        intensity: 0.4,
        at: [sx * 0.1 + 0.012, 0.045, 0.275],
      }),
    );
    hp.push(
      part(new SphereGeometry(0.048, 8, 6), PAL.cheek, {
        at: [sx * 0.165, -0.075, 0.21],
        scale: [1, 0.6, 0.4],
      }),
    );
  }
  const hair = () =>
    hp.push(
      part(new SphereGeometry(0.29, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), PAL.hair, {
        at: [0, 0.01, -0.02],
        rot: [-0.25, 0, 0],
      }),
    );
  if (hat === 'beanie' || hat === 'beanie2') {
    hp.push(
      part(
        new SphereGeometry(0.297, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        hat === 'beanie' ? shirt : dark,
        { at: [0, 0.04, 0] },
      ),
    );
    hp.push(
      part(new TorusGeometry(0.285, 0.055, 8, 28), light, { at: [0, 0.06, 0], rot: [Math.PI / 2, 0, 0] }),
    );
    if (hat === 'beanie') hp.push(part(new SphereGeometry(0.08, 10, 8), PAL.cream, { at: [0, 0.35, 0] }));
    else
      hp.push(
        part(new TorusGeometry(0.22, 0.03, 6, 24), light, { at: [0, 0.21, 0], rot: [Math.PI / 2, 0, 0] }),
      );
  } else if (hat === 'straw') {
    hair();
    const hg: [number, number, number] = [0, 0.13, 0];
    const hr: [number, number, number] = [-0.12, 0, 0];
    hp.push(part(new CylinderGeometry(0.46, 0.48, 0.035, 28), PAL.straw, { at: hg, rot: hr }));
    hp.push(
      part(local(new CylinderGeometry(0.2, 0.25, 0.2, 22), [0, 0.11, 0]), PAL.straw, { at: hg, rot: hr }),
    );
    hp.push(
      part(local(new CylinderGeometry(0.255, 0.255, 0.05, 22), [0, 0.04, 0]), shirt, { at: hg, rot: hr }),
    );
  } else {
    hair();
    hp.push(
      part(new TorusGeometry(0.283, 0.048, 8, 28), shirt, {
        at: [0, 0.1, 0],
        rot: [Math.PI / 2 - 0.15, 0, 0],
      }),
    );
    for (const s of [-1, 1])
      hp.push(
        part(new RoundedBoxGeometry(0.07, 0.16, 0.04, 1, 0.015), shirt, {
          at: [s * 0.04, 0.02, -0.29],
          rot: [0, 0, s * 0.5],
        }),
      );
  }
  head.add(...meshes(bake(hp), 'head'));
  root.add(head);

  // malzemeler ve gölge bayrakları
  group.traverse((o) => {
    if (o instanceof Mesh) {
      o.material = o.name.endsWith('Glow') ? GLOW_MATERIAL : SHARED_MATERIAL;
      o.castShadow = !o.name.endsWith('Glow');
      o.receiveShadow = true;
    }
  });

  let state: VillagerState = 'idle';
  const armR = arms[0]!;
  const armL = arms[1]!;
  const legL = legs[0]!;
  const legR = legs[1]!;
  return {
    group,
    setState(s) {
      state = s;
    },
    anim(t, chopPhase) {
      const ph = t + seed * 1.7;
      root.position.y = 0;
      root.rotation.set(0, 0, 0);
      root.scale.y = 1;
      head.rotation.set(0, 0, 0);
      armR.rotation.set(0, 0, -0.12);
      armL.rotation.set(0, 0, 0.12);
      legL.rotation.x = legR.rotation.x = 0;
      if (state === 'walk') {
        const w = Math.sin(ph * 9);
        legL.rotation.x = w * 0.65;
        legR.rotation.x = -w * 0.65;
        armR.rotation.x = -w * 0.45 - 0.2;
        armL.rotation.x = w * 0.5;
        root.position.y = Math.abs(Math.cos(ph * 9)) * 0.05;
        root.rotation.z = w * 0.03;
      } else if (state === 'chop') {
        const p = Math.min(1, Math.max(0, chopPhase));
        const a =
          p < 0.55
            ? lerp(-0.5, -2.75, smoothstep(0, 0.55, p))
            : p < 0.66
              ? lerp(-2.75, -0.35, (p - 0.55) / 0.11)
              : lerp(-0.35, -0.5, (p - 0.66) / 0.34);
        armR.rotation.x = a;
        armL.rotation.x = a * 0.8;
        armL.rotation.z = -0.15;
        root.rotation.x = p > 0.55 && p < 0.8 ? 0.13 : -0.04 * smoothstep(0, 0.55, p);
        legL.rotation.x = 0.25;
        legR.rotation.x = -0.18;
      } else {
        root.scale.y = 1 + Math.sin(ph * 2.2) * 0.015;
        head.rotation.y = Math.sin(ph * 0.7) * 0.45;
      }
    },
  };
}
