import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { fbm, hash2, lerp, smoothstep, vnoise } from './noise';
import { PAL } from './palette';

export interface TerrainRamp {
  k: number;
  dx: number;
  dz: number;
}
/** Sim IslandGrid ile yapısal olarak uyumlu (assets @gg/sim'e bağlanamaz). */
export interface TerrainGrid {
  size: number;
  level: ArrayLike<number>;
  ramp: ArrayLike<TerrainRamp | null>;
  dWater: ArrayLike<number>;
  dLand: ArrayLike<number>;
}
/** Sim `WATER` ile aynı değer; ad çakışmasın diye farklı isim. */
export const TERRAIN_WATER = -1;
export const LEVEL_H = [0.3, 1.05, 1.6] as const;
export const SUB = 4;
/** Bu kadar hücreden derin su arazi mesh'ine girmez; su shader'ı örter. */
export const TERRAIN_SKIP_DEEP = 4;

export interface HeightField {
  readonly vn: number;
  readonly vh: Float32Array;
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  cellHeight(i: number, j: number, x: number, z: number): number;
}

/** Kit `cellHeight` + `VH` portu: ızgara katlarından sürekli yükseklik alanı. */
export function createHeightField(grid: TerrainGrid, plazaRadius: number): HeightField {
  const N = grid.size;
  const HALF = N / 2;
  const cidx = (i: number, j: number) => j * N + i;
  const inGrid = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
  const cellCenter = (i: number, j: number): [number, number] => [i - HALF + 0.5, j - HALF + 0.5];
  const sampleField = (F: ArrayLike<number>, x: number, z: number): number => {
    const u = Math.min(N - 1.001, Math.max(0, x + HALF - 0.5));
    const v = Math.min(N - 1.001, Math.max(0, z + HALF - 0.5));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    return lerp(
      lerp(F[cidx(i, j)]!, F[cidx(i + 1, j)]!, fu),
      lerp(F[cidx(i, j + 1)]!, F[cidx(i + 1, j + 1)]!, fu),
      fv,
    );
  };
  const cellHeight = (i: number, j: number, x: number, z: number): number => {
    const c = cidx(i, j);
    const L = grid.level[c]!;
    if (L === TERRAIN_WATER) return -0.15 - 1.5 * smoothstep(0.5, 5, sampleField(grid.dLand, x, z));
    const rp = grid.ramp[c];
    if (rp) {
      const [cx, cz] = cellCenter(i, j);
      const t = (x - cx) * rp.dx + (z - cz) * rp.dz + 0.5;
      return lerp(LEVEL_H[rp.k]!, LEVEL_H[rp.k + 1]!, Math.min(1, Math.max(0, t)));
    }
    const base =
      LEVEL_H[L]! + (Math.hypot(x, z) > plazaRadius - 1 ? (vnoise(x * 1.3, z * 1.3, 3) - 0.5) * 0.05 : 0);
    // Kumsal yar değil, yumuşak eğimdir.
    return L === 1 ? lerp(-0.12, base, smoothstep(0.2, 3.2, sampleField(grid.dWater, x, z))) : base;
  };
  const vn = N * SUB + 1;
  const vh = new Float32Array(vn * vn);
  for (let vj = 0; vj < vn; vj++)
    for (let vi = 0; vi < vn; vi++) {
      const x = -HALF + vi / SUB;
      const z = -HALF + vj / SUB;
      const is = vi % SUB === 0 ? [vi / SUB - 1, vi / SUB] : [Math.floor(vi / SUB)];
      const js = vj % SUB === 0 ? [vj / SUB - 1, vj / SUB] : [Math.floor(vj / SUB)];
      let h = -1e9;
      for (const i of is) for (const j of js) if (inGrid(i, j)) h = Math.max(h, cellHeight(i, j, x, z));
      vh[vj * vn + vi] = h;
    }
  const heightAt = (x: number, z: number): number => {
    const u = Math.min(vn - 1.001, Math.max(0, (x + HALF) * SUB));
    const v = Math.min(vn - 1.001, Math.max(0, (z + HALF) * SUB));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    return lerp(
      lerp(vh[j * vn + i]!, vh[j * vn + i + 1]!, fu),
      lerp(vh[(j + 1) * vn + i]!, vh[(j + 1) * vn + i + 1]!, fu),
      fv,
    );
  };
  const slopeAt = (x: number, z: number): number => {
    const e = 0.3;
    return (
      Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e)
    );
  };
  return { vn, vh, heightAt, slopeAt, cellHeight };
}

export const TERRAIN_MATERIAL = new MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.95,
});

/** Kit `buildTerrain` portu; hücre başına SUB×SUB quad, yüz bazlı renk. Derin su atlanır. */
export function buildTerrainGeometry(
  grid: TerrainGrid,
  hf: HeightField,
  plazaRadius: number,
  skipDeep: number = TERRAIN_SKIP_DEEP,
): BufferGeometry {
  const N = grid.size;
  const HALF = N / 2;
  const vn = hf.vn;
  const cidx = (i: number, j: number) => j * N + i;
  const pos: number[] = [];
  const vert = (vi: number, vj: number) => {
    const x = -HALF + vi / SUB;
    const z = -HALF + vj / SUB;
    pos.push(
      x + (vnoise(x * 2.1, z * 2.1, 41) - 0.5) * 0.12,
      hf.vh[vj * vn + vi]!,
      z + (vnoise(x * 2.1, z * 2.1, 43) - 0.5) * 0.12,
    );
  };
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const c = cidx(i, j);
      if (grid.level[c] === TERRAIN_WATER && grid.dLand[c]! >= skipDeep) continue;
      for (let sj = 0; sj < SUB; sj++)
        for (let si = 0; si < SUB; si++) {
          const vi = i * SUB + si;
          const vj = j * SUB + sj;
          // (a,c,b) ve (b,c,d): normal +y
          vert(vi, vj);
          vert(vi, vj + 1);
          vert(vi + 1, vj);
          vert(vi + 1, vj);
          vert(vi, vj + 1);
          vert(vi + 1, vj + 1);
        }
    }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const p = geo.getAttribute('position');
  const cols = new Float32Array(p.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const cc = new Vector3();
  const e1 = new Vector3();
  const e2 = new Vector3();
  const col = new Color();
  const tmp = new Color();
  const sampleDW = (x: number, z: number) => {
    const u = Math.min(N - 1.001, Math.max(0, x + HALF - 0.5));
    const v = Math.min(N - 1.001, Math.max(0, z + HALF - 0.5));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = u - i;
    const fv = v - j;
    const F = grid.dWater;
    return lerp(
      lerp(F[cidx(i, j)]!, F[cidx(i + 1, j)]!, fu),
      lerp(F[cidx(i, j + 1)]!, F[cidx(i + 1, j + 1)]!, fu),
      fv,
    );
  };
  for (let f = 0; f < p.count; f += 3) {
    a.fromBufferAttribute(p, f);
    b.fromBufferAttribute(p, f + 1);
    cc.fromBufferAttribute(p, f + 2);
    const ny = Math.abs(e1.subVectors(b, a).cross(e2.subVectors(cc, a)).normalize().y);
    const cx = (a.x + b.x + cc.x) / 3;
    const cy = (a.y + b.y + cc.y) / 3;
    const cz = (a.z + b.z + cc.z) / 3;
    const r = Math.hypot(cx, cz);
    const ci = Math.floor(cx + HALF);
    const cj = Math.floor(cz + HALF);
    const cell = ci >= 0 && cj >= 0 && ci < N && cj < N ? cidx(ci, cj) : 0;
    const L = grid.level[cell]!;
    const jit = hash2(f, 7, 3) - 0.5;
    if (cy < -0.06) col.set(PAL.seabed).lerp(tmp.set(PAL.sandDark), smoothstep(-1.3, -0.05, cy));
    else if (ny < 0.6) col.set(Math.floor((cy + 3) * 3.4) % 2 ? PAL.cliff : PAL.cliffDark);
    else if (grid.ramp[cell]) col.set(PAL.dirt).lerp(tmp.set(PAL.sand), 0.3);
    else if (L <= 1 && sampleDW(cx, cz) < 2.3 + (vnoise(cx * 0.8, cz * 0.8, 9) - 0.5) * 0.9)
      col.set(PAL.sand).lerp(tmp.set(PAL.sandDark), smoothstep(0.14, -0.04, cy));
    else {
      const g = fbm(cx * 0.22, cz * 0.22, 11, 3);
      col
        .set(PAL.grassDark)
        .lerp(tmp.set(PAL.grass), smoothstep(0.3, 0.5, g))
        .lerp(tmp.set(PAL.grassLight), smoothstep(0.55, 0.75, g));
      if (L === 2) col.lerp(tmp.set(PAL.grassLight), 0.35).offsetHSL(-0.015, 0, 0.02);
      if (L === 1)
        col.lerp(
          tmp.set(PAL.dirt),
          1 - smoothstep(plazaRadius - 3, plazaRadius - 1.8, r + (vnoise(cx * 0.9, cz * 0.9, 5) - 0.5) * 1.6),
        );
    }
    col.offsetHSL(0, 0, jit * 0.045);
    for (let k = 0; k < 3; k++) {
      cols[(f + k) * 3] = col.r;
      cols[(f + k) * 3 + 1] = col.g;
      cols[(f + k) * 3 + 2] = col.b;
    }
  }
  geo.setAttribute('color', new BufferAttribute(cols, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** İnşa modu ızgarası: her kara hücresi kendi yüksekliğinde çerçeve (kit `buildGridLines`). */
export function buildGridLines(grid: TerrainGrid, hf: HeightField): LineSegments {
  const N = grid.size;
  const HALF = N / 2;
  const pts: number[] = [];
  const ins = 0.05;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (grid.level[j * N + i] === TERRAIN_WATER) continue;
      const x = i - HALF + 0.5;
      const z = j - HALF + 0.5;
      const q: [number, number][] = [
        [x - 0.5 + ins, z - 0.5 + ins],
        [x + 0.5 - ins, z - 0.5 + ins],
        [x + 0.5 - ins, z + 0.5 - ins],
        [x - 0.5 + ins, z + 0.5 - ins],
      ];
      for (let k = 0; k < 4; k++) {
        const [ax, az] = q[k]!;
        const [bx, bz] = q[(k + 1) % 4]!;
        pts.push(ax, hf.cellHeight(i, j, ax, az) + 0.03, az, bx, hf.cellHeight(i, j, bx, bz) + 0.03, bz);
      }
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  const l = new LineSegments(
    g,
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  l.visible = false;
  return l;
}

export interface WaterModel {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  setTime(t: number): void;
  setNight(night: number): void;
  setLight(sunColor: Color): void;
  /** Geometri, shader malzemesi ve yükseklik dokusu bırakılır. */
  dispose(): void;
}
const NIGHT_TINT = new Color(0.16, 0.2, 0.38);
export const WATER_SEGMENTS = 64;

/** Kit `buildWater` portu: derinlik tonu + kıyı köpüğü + parıltı; yükseklik dokusu heightfield'dan. */
export function createWater(hf: HeightField, size: number): WaterModel {
  const N = 192;
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const h = hf.heightAt((i / (N - 1) - 0.5) * size, (j / (N - 1) - 0.5) * size);
      const v = Math.round(Math.min(1, Math.max(0, (h + 3) / 6)) * 255);
      const o = (j * N + i) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  const hTex = new DataTexture(data, N, N);
  hTex.magFilter = hTex.minFilter = LinearFilter;
  hTex.needsUpdate = true;
  const mat = new ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: hTex },
      uSize: { value: size },
      uNight: { value: 0 },
      uShallow: { value: new Color(PAL.waterShallow) },
      uDeep: { value: new Color(PAL.waterDeep) },
      uFoam: { value: new Color(PAL.foam) },
      uLight: { value: new Color(1, 1, 1) },
    },
    vertexShader: `uniform float uTime; varying vec3 vW;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0);
        w.y += sin(w.x*0.6+uTime*1.2)*0.035 + sin(w.z*0.8-uTime*0.9)*0.03;
        vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D uHeight; uniform float uSize, uTime, uNight; uniform vec3 uShallow, uDeep, uFoam, uLight; varying vec3 vW;
      void main(){
        vec2 uv = vW.xz/uSize + 0.5; float h = texture2D(uHeight, clamp(uv,0.0,1.0)).r*6.0-3.0;
        float depth = max(0.0, -h);
        float sh = smoothstep(0.0, 1.5, depth);
        vec3 col = mix(uShallow, uDeep, sh);
        float edge = 1.0 - smoothstep(0.0, 0.13 + 0.05*sin(uTime*1.6 + vW.x*0.7 + vW.z*0.4), depth);
        float rip = smoothstep(0.82, 0.95, fract(depth*2.4 - uTime*0.35)) * (1.0 - smoothstep(0.05, 0.75, depth));
        col = mix(col, uFoam, clamp(edge + rip*0.55, 0.0, 1.0));
        float sp = pow(max(0.0, sin(vW.x*1.7+sin(vW.z*0.9)*2.0+uTime*1.1)*sin(vW.z*2.1+sin(vW.x*0.7)*2.0-uTime*0.9)), 60.0) * 0.35 * (1.0-uNight) * sh;
        col = col*uLight + sp;
        gl_FragColor = vec4(col, max(mix(0.62, 0.94, sh), edge));
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(420, 420, WATER_SEGMENTS, WATER_SEGMENTS), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  const sun = new Color();
  let night = 0;
  const relight = () => {
    (mat.uniforms.uLight!.value as Color).setRGB(1, 1, 1).lerp(NIGHT_TINT, night).lerp(sun, 0.12);
  };
  return {
    mesh,
    setTime(t) {
      mat.uniforms.uTime!.value = t;
    },
    setNight(n) {
      night = n;
      mat.uniforms.uNight!.value = n;
      relight();
    },
    setLight(sunColor) {
      sun.copy(sunColor);
      relight();
    },
    dispose() {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mat.dispose();
      hTex.dispose();
    },
  };
}
