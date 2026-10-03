import { type Baked, type HeightField, makeFenceCell, makeLantern, makeTower } from '@gg/assets';
import { type BuildableKind, type PlacementCell, type Rotation, cellCenter } from '@gg/sim';
import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  type Scene,
  Vector3,
} from 'three';

export interface BuildPreview {
  kind: BuildableKind;
  cells: PlacementCell[];
  rot: Rotation;
  allOk: boolean;
}
export interface BuildGhost {
  set(preview: BuildPreview | null): void;
  dispose(): void;
}

const MAX_CELLS = 64;
const OK = 0x6ce07a;
const BAD = 0xff5a4a;
const GHOST_OK = 0xb8f5c0;
const GHOST_BAD = 0xffb0a8;

/** Kit inşa modu: ayak izi kareleri yeşil/kırmızı, yarı saydam hayalet model. */
export function createBuildGhost(scene: Scene, hf: HeightField): BuildGhost {
  const root = new Group();
  root.renderOrder = 6;
  const quadGeo = new PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
  const okQuads = new InstancedMesh(
    quadGeo,
    new MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.42, depthWrite: false }),
    MAX_CELLS,
  );
  const badQuads = new InstancedMesh(
    quadGeo,
    new MeshBasicMaterial({ color: BAD, transparent: true, opacity: 0.48, depthWrite: false }),
    MAX_CELLS,
  );
  okQuads.count = badQuads.count = 0;
  const ghostMat = new MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const ghostMesh = (b: Baked) => new Mesh(b.opaque ?? undefined, ghostMat);
  const models: Record<Exclude<BuildableKind, 'fence'>, Mesh> = {
    arrowTower: ghostMesh(makeTower()),
    lantern: ghostMesh(makeLantern()),
  };
  const fenceGhost = new InstancedMesh(makeFenceCell(0).opaque ?? undefined, ghostMat, MAX_CELLS);
  fenceGhost.count = 0;
  for (const o of [okQuads, badQuads, fenceGhost, ...Object.values(models)]) {
    o.frustumCulled = false;
    o.castShadow = false;
    o.visible = false;
    root.add(o);
  }
  scene.add(root);
  const m = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);
  const tint = new Color();
  return {
    set(preview) {
      for (const o of root.children) o.visible = false;
      okQuads.count = badQuads.count = fenceGhost.count = 0;
      if (!preview) return;
      let ok = 0;
      let bad = 0;
      let cx = 0;
      let cz = 0;
      const valid = preview.cells.filter((c) => c.issue !== 'Off map');
      for (const c of valid) {
        const [x, z] = cellCenter(c.i, c.j);
        cx += x / valid.length;
        cz += z / valid.length;
        m.compose(p.set(x, hf.heightAt(x, z) + 0.05, z), q.identity(), s);
        if (c.issue) badQuads.setMatrixAt(bad++, m);
        else okQuads.setMatrixAt(ok++, m);
      }
      okQuads.count = ok;
      badQuads.count = bad;
      okQuads.instanceMatrix.needsUpdate = badQuads.instanceMatrix.needsUpdate = true;
      okQuads.visible = badQuads.visible = true;
      ghostMat.color.copy(tint.set(preview.allOk ? GHOST_OK : GHOST_BAD));
      if (valid.length === 0) return;
      if (preview.kind === 'fence') {
        const first = valid[0]!;
        const last = valid[valid.length - 1]!;
        const alongZ = valid.length > 1 ? first.i === last.i : preview.rot % 2 === 1;
        let n = 0;
        for (const c of valid) {
          const [x, z] = cellCenter(c.i, c.j);
          fenceGhost.setMatrixAt(
            n++,
            m.compose(p.set(x, hf.heightAt(x, z), z), q.setFromAxisAngle(up, alongZ ? Math.PI / 2 : 0), s),
          );
        }
        fenceGhost.count = n;
        fenceGhost.instanceMatrix.needsUpdate = true;
        fenceGhost.visible = true;
      } else {
        const g = models[preview.kind];
        g.position.set(cx, hf.heightAt(cx, cz), cz);
        g.rotation.y = (preview.rot * Math.PI) / 2;
        g.visible = true;
      }
    },
    dispose() {
      scene.remove(root);
      quadGeo.dispose();
      okQuads.dispose();
      badQuads.dispose();
      fenceGhost.dispose();
      fenceGhost.geometry.dispose();
      for (const g of Object.values(models)) g.geometry.dispose();
      (okQuads.material as MeshBasicMaterial).dispose();
      (badQuads.material as MeshBasicMaterial).dispose();
      ghostMat.dispose();
    },
  };
}
