import { Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three';
import { type Baked, type Part, bake, jitterGeo, part } from '../geometry';
import { hash2, rng } from '../noise';
import { PAL } from '../palette';

/** Çam: gövde + 4 koni (kit `makePine`). */
export function makePine(seed = 1, s = 1): Baked {
  const R = rng(seed);
  const parts: Part[] = [
    part(jitterGeo(new CylinderGeometry(0.1 * s, 0.17 * s, 0.9 * s, 6), 0.03, seed), PAL.bark, {
      flat: true,
      at: [0, 0.45 * s, 0],
    }),
  ];
  const cA = new Color(PAL.pineDark);
  const cB = new Color(PAL.pineLight);
  for (let k = 0; k < 4; k++) {
    const r = (1.0 - k * 0.2) * s * (0.9 + R() * 0.2);
    const geo = jitterGeo(new ConeGeometry(r, 0.95 * s, 7, 1), 0.07 * s, seed * 10 + k, 2.0);
    parts.push(
      part(
        geo,
        cA
          .clone()
          .lerp(cB, k / 3)
          .getHex(),
        { flat: true, at: [0, (0.88 + k * 0.5) * s, 0], rot: [0, R() * Math.PI, 0] },
      ),
    );
  }
  return bake(parts);
}

/** Meşe: gövde + dal + 5 yaprak topağı (kit `makeOak`). */
export function makeOak(seed = 1, s = 1): Baked {
  const parts: Part[] = [
    part(jitterGeo(new CylinderGeometry(0.13 * s, 0.22 * s, 1.3 * s, 7), 0.04, seed), PAL.bark, {
      flat: true,
      at: [0, 0.65 * s, 0],
    }),
    part(new CylinderGeometry(0.05 * s, 0.08 * s, 0.6 * s, 5), PAL.bark, {
      flat: true,
      at: [0.2 * s, 1.15 * s, 0],
      rot: [0, 0, -0.8],
    }),
  ];
  const blobs: [number, number, number, number][] = [
    [0, 1.75, 0, 0.75],
    [0.48, 1.55, 0.15, 0.5],
    [-0.42, 1.62, -0.1, 0.55],
    [0.1, 2.18, -0.15, 0.5],
    [-0.12, 1.6, 0.45, 0.45],
  ];
  const cols = [PAL.leaf, PAL.leafDark, PAL.leafLight, PAL.leaf, PAL.leafDark];
  blobs.forEach(([x, y, z, r], i) =>
    parts.push(
      part(jitterGeo(new IcosahedronGeometry(r * s, 1), 0.11 * s, seed * 7 + i, 2.5), cols[i] as number, {
        flat: true,
        at: [x * s, y * s, z * s],
      }),
    ),
  );
  return bake(parts);
}

/** Çalı: 3 topak + 6 böğürtlen (kit `makeBush`). */
export function makeBush(seed = 1): Baked {
  const R = rng(seed);
  const parts: Part[] = [];
  const blobs: [number, number, number, number][] = [
    [0, 0.28, 0, 0.36],
    [0.3, 0.22, 0.1, 0.27],
    [-0.25, 0.22, -0.08, 0.28],
  ];
  blobs.forEach(([x, y, z, r], i) =>
    parts.push(
      part(jitterGeo(new IcosahedronGeometry(r, 1), 0.06, seed * 3 + i, 3), i ? PAL.leafDark : PAL.leaf, {
        flat: true,
        at: [x, y, z],
      }),
    ),
  );
  for (let i = 0; i < 6; i++) {
    const a = R() * Math.PI * 2;
    parts.push(
      part(new SphereGeometry(0.045, 6, 4), PAL.berry, {
        at: [Math.cos(a) * 0.32, 0.25 + R() * 0.25, Math.sin(a) * 0.3],
      }),
    );
  }
  return bake(parts);
}

/** Kaya parçası: yassı, bozulmuş ikosahedron; üst yüzler yosunlu (kit `makeRockMesh`). */
export function rockPart(
  seed: number,
  s: number,
  mossy: boolean,
  at: [number, number, number] = [0, 0, 0],
): Part {
  const geo = jitterGeo(new IcosahedronGeometry(s, 1), 0.26 * s, seed, 1.8 / s);
  geo.scale(1, 0.62, 1);
  return part(geo, PAL.rock, {
    flat: true,
    at: [at[0], at[1] + s * 0.25, at[2]],
    colorOf: (f, ny) => {
      const v = hash2(f * 3, seed, 9);
      if (mossy && ny > 0.6 && v > 0.3) return PAL.moss;
      return v > 0.5 ? PAL.rock : PAL.rockDark;
    },
  });
}
/** Kaya kaynağı: büyük + küçük kaya (kit `makeRock`). */
export function makeRock(seed = 1, s = 0.75): Baked {
  return bake([rockPart(seed, s, true), rockPart(seed + 9, s * 0.45, true, [s * 0.8, s * 0.1, s * 0.3])]);
}

/** Çimen tutamı: 5 yaprak; beyaz → rengi instance verir. */
export function makeGrassTuft(): Baked {
  const blade = (rx: number, ry: number) => {
    const g = new ConeGeometry(0.035, 0.32, 3);
    g.translate(0, 0.16, 0);
    g.rotateZ(rx);
    g.rotateY(ry);
    return g;
  };
  return bake(
    [blade(0, 0), blade(0.35, 0.3), blade(0.35, 2.4), blade(0.4, 4.3), blade(0.15, 1.3)].map((g) =>
      part(g, 0xffffff, { flat: true }),
    ),
  );
}
export function makeFlower(): Baked {
  return bake([part(new IcosahedronGeometry(0.06, 0), 0xffffff, { flat: true })]);
}
export function makePebble(): Baked {
  return bake([part(new IcosahedronGeometry(0.07, 0), 0xffffff, { flat: true })]);
}
