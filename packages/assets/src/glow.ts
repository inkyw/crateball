import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';

/** Sahte ışık havuzu dokusu (radyal gradyan). DOM gerekir; testlerde çağrılmaz. */
export function createGlowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d context yok');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface GlowPool {
  /** Sahnedeki mesh (ensureCapacity sonrası yenisi). */
  readonly mesh: InstancedMesh;
  readonly capacity: number;
  /** Kapasite yetmezse büyütür (sahnedeki mesh değişir; eskisi dispose edilir). */
  ensureCapacity(n: number): void;
  /** base: kit'teki temel opaklık (Hearth 0.75, fener 0.55, Glowbug 0.5); additive karışımda renk ölçeği olarak uygulanır. */
  set(i: number, x: number, y: number, z: number, size: number, color: number, base: number): void;
  setCount(n: number): void;
  setNight(night: number): void;
  dispose(): void;
}

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const _s = new Vector3();
const _c = new Color();

/** Tüm zemin haleleri tek InstancedMesh: fener, Hearth, Glowbug. Gece dışında görünmez. */
export function createGlowPool(max: number, texture: CanvasTexture | null): GlowPool {
  const mat = new MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const geo = new PlaneGeometry(1, 1);
  let capacity = Math.max(1, max);
  const build = (n: number) => {
    const m = new InstancedMesh(geo, mat, n);
    m.count = 0;
    m.renderOrder = 5;
    m.frustumCulled = false;
    return m;
  };
  let mesh = build(capacity);
  return {
    get mesh() {
      return mesh;
    },
    get capacity() {
      return capacity;
    },
    ensureCapacity(n) {
      if (n <= capacity) return;
      while (capacity < n) capacity *= 2;
      const fresh = build(capacity);
      fresh.visible = mesh.visible;
      mesh.parent?.add(fresh);
      mesh.removeFromParent();
      mesh.dispose();
      mesh = fresh;
    },
    set(i, x, y, z, size, color, base) {
      mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(size, size, 1)));
      mesh.setColorAt(i, _c.set(color).multiplyScalar(base));
    },
    setCount(n) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    setNight(night) {
      mat.opacity = night;
      mesh.visible = night > 0.02;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}
