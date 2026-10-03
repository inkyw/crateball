import {
  type HeightField,
  type InstancedModel,
  PAL,
  TERRAIN_MATERIAL,
  type WaterModel,
  buildGridLines,
  buildTerrainGeometry,
  composeMatrix,
  createHeightField,
  createInstanced,
  createWater,
  makeFlower,
  makeGrassTuft,
  makePebble,
  rng,
} from '@gg/assets';
import { GRID_SIZE, type GameState, ISLAND_RADIUS, PLAZA_RADIUS } from '@gg/sim';
import { Color, type LineSegments, Matrix4, Mesh, type Scene } from 'three';
import { RENDER } from './config';

export interface TerrainView {
  heightField: HeightField;
  terrainMesh: Mesh;
  gridLines: LineSegments;
  water: WaterModel;
  dispose(): void;
}

const GRASS_COLORS = [PAL.grass, PAL.grassLight, PAL.leafLight, PAL.grassDark];
const FLOWER_COLORS = [PAL.flower1, PAL.flower2, PAL.flower3, PAL.flower4];

/** Çimen/çiçek/çakıl: kit kuralları (h ≥ 0.42, r ≥ 4.6, eğim ≤ 0.22; çakıl kumsalda). Seed'li. */
function scatterFlora(scene: Scene, hf: HeightField, seed: number): InstancedModel[] {
  const R = rng(seed ^ 0x5eed);
  const grass = createInstanced(makeGrassTuft(), RENDER.grassCount, { castShadow: false });
  const flowers = createInstanced(makeFlower(), RENDER.flowerCount, { castShadow: false });
  const pebbles = createInstanced(makePebble(), RENDER.pebbleCount, { castShadow: false });
  const m = new Matrix4();
  const c = new Color();
  let gi = 0;
  let fi = 0;
  let pi = 0;
  for (let k = 0; k < 16000 && (gi < RENDER.grassCount || fi < RENDER.flowerCount); k++) {
    const x = (R() - 0.5) * 2 * ISLAND_RADIUS;
    const z = (R() - 0.5) * 2 * ISLAND_RADIUS;
    const h = hf.heightAt(x, z);
    if (h < 0.42 || Math.hypot(x, z) < PLAZA_RADIUS - 2.4 || hf.slopeAt(x, z) > 0.22) continue;
    const yaw = R() * Math.PI * 2;
    if (gi < RENDER.grassCount) {
      grass.setMatrixAt(gi, composeMatrix(x, h - 0.02, z, yaw, 0.7 + R() * 0.7, m));
      grass.opaque!.setColorAt(gi++, c.set(GRASS_COLORS[Math.floor(R() * 4)] as number));
    } else if (fi < RENDER.flowerCount) {
      flowers.setMatrixAt(fi, composeMatrix(x, h + 0.05, z, yaw, 1, m));
      flowers.opaque!.setColorAt(fi++, c.set(FLOWER_COLORS[Math.floor(R() * 4)] as number));
    }
  }
  for (let k = 0; k < 9000 && pi < RENDER.pebbleCount; k++) {
    const x = (R() - 0.5) * 2 * ISLAND_RADIUS;
    const z = (R() - 0.5) * 2 * ISLAND_RADIUS;
    const h = hf.heightAt(x, z);
    if (h < 0.0 || h > 0.32) continue;
    pebbles.setMatrixAt(pi, composeMatrix(x, h, z, R() * Math.PI * 2, 0.7 + R(), m));
    pebbles.opaque!.setColorAt(pi++, c.set(R() > 0.5 ? PAL.rock : PAL.pebbleLight));
  }
  grass.setCount(gi);
  flowers.setCount(fi);
  pebbles.setCount(pi);
  for (const im of [grass, flowers, pebbles]) {
    im.commit();
    if (im.opaque?.instanceColor) im.opaque.instanceColor.needsUpdate = true;
    scene.add(...im.objects);
  }
  return [grass, flowers, pebbles];
}

export function createTerrainView(scene: Scene, state: GameState): TerrainView {
  const hf = createHeightField(state.island, PLAZA_RADIUS);
  const terrainMesh = new Mesh(
    buildTerrainGeometry(state.island, hf, PLAZA_RADIUS, RENDER.terrainSkipDeep),
    TERRAIN_MATERIAL,
  );
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  const gridLines = buildGridLines(state.island, hf);
  const water = createWater(hf, GRID_SIZE);
  scene.add(terrainMesh, gridLines, water.mesh);
  const flora = scatterFlora(scene, hf, state.seed);
  return {
    heightField: hf,
    terrainMesh,
    gridLines,
    water,
    dispose() {
      scene.remove(terrainMesh, gridLines);
      terrainMesh.geometry.dispose(); // TERRAIN_MATERIAL paylaşılır, kalır
      gridLines.geometry.dispose();
      (gridLines.material as { dispose(): void }).dispose();
      water.dispose();
      for (const f of flora) f.dispose();
    },
  };
}
