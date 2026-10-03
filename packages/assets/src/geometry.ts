import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { lerp, noise3 } from './noise';

export interface PartOptions {
  at?: [number, number, number];
  /** Euler XYZ (radyan). */
  rot?: [number, number, number];
  scale?: number | [number, number, number];
  /** Yüz başına normal (faceted görünüm). */
  flat?: boolean;
  /** Parlayan parça: ayrı geometriye gider, GLOW_MATERIAL ile çizilir. */
  glow?: boolean;
  /** Glow rengi çarpanı (>1 HDR → bloom). */
  intensity?: number;
  /** Yüz başına renk (kaya yosunu, arazi): (yüz indeksi, yüz normalinin y'si, yüz merkezi) → palet rengi. `color`'ı ezer. */
  colorOf?: (face: number, ny: number, cx: number, cy: number, cz: number) => number;
}
export interface Part {
  geometry: BufferGeometry;
  color: number;
  glow: boolean;
  intensity: number;
  colorOf: PartOptions['colorOf'] | null;
}
export interface Baked {
  opaque: BufferGeometry | null;
  glow: BufferGeometry | null;
  triangles: number;
}

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _euler = new Euler();
const _m = new Matrix4();

/** Bir parça: geometri + palet rengi (+ dönüşüm). Geometri yerinde dönüştürülür. */
export function part(geometry: BufferGeometry, color: number, o: PartOptions = {}): Part {
  let g = geometry;
  if (o.flat && g.index) g = g.toNonIndexed();
  const s = o.scale ?? 1;
  _pos.set(...(o.at ?? [0, 0, 0]));
  _quat.setFromEuler(_euler.set(...(o.rot ?? [0, 0, 0])));
  if (typeof s === 'number') _scale.setScalar(s);
  else _scale.set(...s);
  g.applyMatrix4(_m.compose(_pos, _quat, _scale));
  if (o.flat || !g.getAttribute('normal')) g.computeVertexNormals();
  return {
    geometry: g,
    color,
    glow: o.glow ?? false,
    intensity: o.intensity ?? 1,
    colorOf: o.colorOf ?? null,
  };
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
function withColor(p: Part): BufferGeometry {
  let g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry;
  if (g === p.geometry) g = g.clone();
  g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const n = pos.count;
  const c = new Color(p.color);
  const k = p.glow ? p.intensity : 1;
  const arr = new Float32Array(n * 3);
  for (let f = 0; f < n; f += 3) {
    if (p.colorOf) {
      _a.fromBufferAttribute(pos, f);
      _b.fromBufferAttribute(pos, f + 1);
      _c.fromBufferAttribute(pos, f + 2);
      const ny = _b.sub(_a).cross(_c.sub(_a)).normalize().y;
      _a.fromBufferAttribute(pos, f)
        .add(_b.fromBufferAttribute(pos, f + 1))
        .add(_c.fromBufferAttribute(pos, f + 2))
        .divideScalar(3);
      c.set(p.colorOf(f / 3, ny, _a.x, _a.y, _a.z));
    }
    for (let v = f; v < f + 3; v++) {
      arr[v * 3] = c.r * k;
      arr[v * 3 + 1] = c.g * k;
      arr[v * 3 + 2] = c.b * k;
    }
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

/** Parçaları iki geometriye indirger: opak (SHARED_MATERIAL) + parlayan (GLOW_MATERIAL). */
export function bake(parts: Part[]): Baked {
  const opaque = parts.filter((p) => !p.glow).map(withColor);
  const glow = parts.filter((p) => p.glow).map(withColor);
  const merge = (list: BufferGeometry[]): BufferGeometry | null => {
    if (list.length === 0) return null;
    const merged = mergeGeometries(list, false);
    if (!merged) throw new Error('bake: geometriler birleştirilemedi (öznitelikler uyumsuz)');
    merged.computeBoundingSphere();
    return merged;
  };
  const o = merge(opaque);
  const gl = merge(glow);
  const tri = (g: BufferGeometry | null) => (g ? g.getAttribute('position').count / 3 : 0);
  return { opaque: o, glow: gl, triangles: tri(o) + tri(gl) };
}

export function jitterGeo(geo: BufferGeometry, amp: number, seed = 1, sc = 1.7): BufferGeometry {
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    p.setXYZ(
      i,
      x + (noise3(x * sc, y * sc, z * sc, seed) - 0.5) * amp * 2,
      y + (noise3(y * sc + 3, z * sc, x * sc, seed + 1) - 0.5) * amp * 2,
      z + (noise3(z * sc - 2, x * sc, y * sc, seed + 2) - 0.5) * amp * 2,
    );
  }
  geo.computeVertexNormals();
  return geo;
}
export function smoothBlob(r: number, detail: number, amp: number, seed: number, sc = 2): BufferGeometry {
  let geo: BufferGeometry = new IcosahedronGeometry(r, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  return jitterGeo(geo, amp, seed, sc);
}

/** Tek paylaşılan opak malzeme (köşe renkli) ve tek parlayan malzeme. */
export const SHARED_MATERIAL = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  metalness: 0,
});
export const GLOW_MATERIAL = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
/** Gündüz parlayan parçalar sönük (0.4×), gece tam. */
export const GLOW_DAY_LEVEL = 0.4;
export function setGlowLevel(night: number): void {
  GLOW_MATERIAL.color.setScalar(lerp(GLOW_DAY_LEVEL, 1, Math.min(1, Math.max(0, night))));
}
setGlowLevel(0);

export interface InstancedModel {
  opaque: InstancedMesh | null;
  glow: InstancedMesh | null;
  /** Sahnedeki nesneler (ensureCapacity sonrası yenileri). */
  readonly objects: InstancedMesh[];
  readonly capacity: number;
  /** Kapasite yetmezse buffer'ları büyütür (2'nin kuvveti), eskileri sahneden çıkarıp dispose eder. Matrisler her kare yeniden yazılır. */
  ensureCapacity(n: number): void;
  setMatrixAt(i: number, m: Matrix4): void;
  setCount(n: number): void;
  /** Matrisler değiştikten sonra bir kez çağrılır. */
  commit(): void;
  /** Sahip olunan geometri ve instance buffer'larını bırakır; paylaşılan malzemelere dokunmaz. */
  dispose(): void;
}
export function createInstanced(
  baked: Baked,
  initialMax: number,
  o: { castShadow?: boolean } = {},
): InstancedModel {
  let capacity = Math.max(1, initialMax);
  const mk = (
    g: BufferGeometry | null,
    mat: MeshStandardMaterial | MeshBasicMaterial,
    shadow: boolean,
    max: number,
  ): InstancedMesh | null => {
    if (!g) return null;
    const im = new InstancedMesh(g, mat, max);
    im.count = 0;
    im.castShadow = shadow;
    im.receiveShadow = shadow;
    im.frustumCulled = false;
    return im;
  };
  const build = (max: number) => {
    const opaque = mk(baked.opaque, SHARED_MATERIAL, o.castShadow ?? true, max);
    const glow = mk(baked.glow, GLOW_MATERIAL, false, max);
    return { opaque, glow, objects: [opaque, glow].filter((x): x is InstancedMesh => x !== null) };
  };
  let cur = build(capacity);
  const model: InstancedModel = {
    get opaque() {
      return cur.opaque;
    },
    get glow() {
      return cur.glow;
    },
    get objects() {
      return cur.objects;
    },
    get capacity() {
      return capacity;
    },
    ensureCapacity(n) {
      if (n <= capacity) return;
      while (capacity < n) capacity *= 2;
      const next = build(capacity);
      cur.objects.forEach((old, k) => {
        const fresh = next.objects[k] as InstancedMesh;
        old.parent?.add(fresh);
        old.removeFromParent();
        old.dispose(); // instance buffer'ları; geometri paylaşılır, malzeme paylaşılır
      });
      cur = next;
    },
    setMatrixAt(i, m) {
      for (const im of cur.objects) im.setMatrixAt(i, m);
    },
    setCount(n) {
      for (const im of cur.objects) im.count = n;
    },
    commit() {
      for (const im of cur.objects) im.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const im of cur.objects) {
        im.removeFromParent();
        im.dispose();
      }
      baked.opaque?.dispose();
      baked.glow?.dispose();
    },
  };
  return model;
}

/** Tekil modeller (Hearth, hayalet) için: en fazla iki Mesh içeren Group. */
export function bakedToGroup(baked: Baked, o: { castShadow?: boolean } = {}): Group {
  const g = new Group();
  if (baked.opaque) {
    const m = new Mesh(baked.opaque, SHARED_MATERIAL);
    m.castShadow = o.castShadow ?? true;
    m.receiveShadow = true;
    g.add(m);
  }
  if (baked.glow) {
    const m = new Mesh(baked.glow, GLOW_MATERIAL);
    m.castShadow = false;
    g.add(m);
  }
  return g;
}

const _up = new Vector3(0, 1, 0);
/** Konum + Y dönüşü + tekdüze ölçek matrisi (instance güncellemeleri için). */
export function composeMatrix(
  x: number,
  y: number,
  z: number,
  yaw: number,
  scale: number,
  out: Matrix4,
): Matrix4 {
  return out.compose(_pos.set(x, y, z), _quat.setFromAxisAngle(_up, yaw), _scale.setScalar(scale));
}
/** Eksen bazlı ölçek + Y dönüşü (yaratık ezilme/zıplama animasyonu). */
export function composeMatrixScaled(
  x: number,
  y: number,
  z: number,
  yaw: number,
  sx: number,
  sy: number,
  sz: number,
  tiltZ: number,
  out: Matrix4,
): Matrix4 {
  _quat.setFromEuler(_euler.set(0, yaw, tiltZ));
  return out.compose(_pos.set(x, y, z), _quat, _scale.set(sx, sy, sz));
}
