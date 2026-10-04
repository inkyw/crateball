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
import { BUILD_GHOST } from './config';

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

/** Kit inşa modu: ayak izi kareleri yeşil/kırmızı, yarı saydam hayalet model. */
export function createBuildGhost(scene: Scene, hf: HeightField): BuildGhost {
  const root = new Group();
  root.renderOrder = BUILD_GHOST.renderOrder;
  const quadGeo = new PlaneGeometry(BUILD_GHOST.quadSize, BUILD_GHOST.quadSize).rotateX(-Math.PI / 2);
  const okQuads = new InstancedMesh(
    quadGeo,
    new MeshBasicMaterial({
      color: BUILD_GHOST.okColor,
      transparent: true,
      opacity: BUILD_GHOST.okOpacity,
      depthWrite: false,
    }),
    BUILD_GHOST.maxCells,
  );
  const badQuads = new InstancedMesh(
    quadGeo,
    new MeshBasicMaterial({
      color: BUILD_GHOST.badColor,
      transparent: true,
      opacity: BUILD_GHOST.badOpacity,
      depthWrite: false,
    }),
    BUILD_GHOST.maxCells,
  );
  okQuads.count = badQuads.count = 0;
  const ghostMat = new MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: BUILD_GHOST.ghostOpacity,
    depthWrite: false,
  });
  const ghostMesh = (b: Baked) => new Mesh(b.opaque ?? undefined, ghostMat);
  const models: Record<Exclude<BuildableKind, 'fence'>, Mesh> = {
    arrowTower: ghostMesh(makeTower()),
    lantern: ghostMesh(makeLantern()),
  };
  const fenceGhost = new InstancedMesh(makeFenceCell(0).opaque ?? undefined, ghostMat, BUILD_GHOST.maxCells);
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
        m.compose(p.set(x, hf.heightAt(x, z) + BUILD_GHOST.quadLift, z), q.identity(), s);
        if (c.issue) badQuads.setMatrixAt(bad++, m);
        else okQuads.setMatrixAt(ok++, m);
      }
      okQuads.count = ok;
      badQuads.count = bad;
      okQuads.instanceMatrix.needsUpdate = badQuads.instanceMatrix.needsUpdate = true;
      okQuads.visible = badQuads.visible = true;
      ghostMat.color.copy(tint.set(preview.allOk ? BUILD_GHOST.ghostOkColor : BUILD_GHOST.ghostBadColor));
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
