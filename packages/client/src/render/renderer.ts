import {
  type Lighting,
  type PostPipeline,
  createGlowPool,
  createGlowTexture,
  createLighting,
  createPostPipeline,
  setGlowLevel,
} from '@gg/assets';
import type { GameState, Vec2 } from '@gg/sim';
import {
  Color,
  Group,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
  NeutralToneMapping,
  PCFShadowMap,
} from 'three';
import type { PoseSnapshot as PrevPositions } from '@gg/sim';
import { type BuildGhost, type BuildPreview, createBuildGhost } from './build-ghost';
import { type FollowCamera, createFollowCamera } from './camera';
import { RENDER } from './config';
import { type EntityViews, createEntityViews } from './entity-views';
import { type HearthView, createHearthView } from './hearth-view';
import { type PlayerView, createPlayerView } from './player-view';
import { type TerrainView, createTerrainView } from './terrain-view';
import { timeOfDay } from './time-of-day';

export interface RenderStats {
  calls: number;
  triangles: number;
}
export interface GameRenderer {
  scene: Scene;
  camera: FollowCamera;
  /** Debug çizimleri (Task 18) buraya eklenir. */
  debugGroup: Group;
  readonly night: number;
  readonly terrain: TerrainView | null;
  /** Post efektlerinin durumu (perf testi doğrular). */
  readonly effects: { ao: boolean; bloom: boolean; tilt: boolean };
  /** renderer.info.memory (restart döngüsü sızıntı testi). */
  readonly memory: { geometries: number; textures: number };
  /** Yeni run: ada ve statik sahne (eski dünya atılır). */
  setWorld(state: GameState): void;
  render(state: GameState, prev: PrevPositions, alpha: number, playerId: number, nowMs: number): RenderStats;
  resize(width: number, height: number, pixelRatio: number): void;
  pick(clientX: number, clientY: number): Vec2 | null;
  setBuildPreview(preview: BuildPreview | null): void;
  setGridVisible(on: boolean): void;
  dispose(): void;
}

export function createGameRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap; // PCFSoftShadowMap 0.186'da kaldırıldı (uyarıyla PCF'e düşer)
  // GTAOPass sahneyi ikinci kez çizer; gölge haritası karede yalnızca bir kez (ilk render) güncellensin.
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  const scene = new Scene();
  scene.background = new Color(0x8fd0f2);
  const camera = createFollowCamera();
  const lighting: Lighting = createLighting(scene, {
    shadowMapSize: RENDER.shadowMapSize,
    shadowExtent: RENDER.shadowExtent,
  });
  const glowTex = createGlowTexture();
  const glowPool = createGlowPool(RENDER.maxGlowPools, glowTex);
  scene.add(glowPool.mesh);
  const debugGroup = new Group();
  scene.add(debugGroup);
  const post: PostPipeline = createPostPipeline(renderer, scene, camera.camera, 1, 1);
  let width = 1;
  let height = 1;
  let terrain: TerrainView | null = null;
  let entities: EntityViews | null = null;
  let player: PlayerView | null = null;
  let hearth: HearthView | null = null;
  let ghost: BuildGhost | null = null;
  let night = 0;
  let lastMs: number | null = null;
  const ray = new Raycaster();
  const ndc = new Vector2();

  const clearWorld = () => {
    entities?.dispose();
    player?.dispose();
    hearth?.dispose();
    ghost?.dispose();
    terrain?.dispose();
    entities = player = hearth = ghost = terrain = null;
  };

  return {
    scene,
    camera,
    debugGroup,
    get night() {
      return night;
    },
    get terrain() {
      return terrain;
    },
    get effects() {
      return post.getEnabled();
    },
    get memory() {
      return { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    },
    setWorld(state) {
      clearWorld();
      terrain = createTerrainView(scene, state);
      entities = createEntityViews(scene, terrain.heightField, glowPool);
      player = createPlayerView(scene, terrain.heightField);
      hearth = createHearthView(scene, terrain.heightField, glowTex);
      ghost = createBuildGhost(scene, terrain.heightField);
      camera.focus.set(0, terrain.heightField.heightAt(0, 3.5), 3.5);
      lastMs = null;
    },
    render(state, prev, alpha, playerId, nowMs) {
      const tS = nowMs / 1000;
      const dtS = lastMs === null ? 0 : (nowMs - lastMs) / 1000;
      lastMs = nowMs;
      if (terrain && entities && player && hearth) {
        const hf = terrain.heightField;
        const p = state.players[playerId];
        const q = prev.players[playerId];
        if (p) {
          const x = q ? q.x + (p.x - q.x) * alpha : p.x;
          const z = q ? q.z + (p.z - q.z) * alpha : p.z;
          camera.update(x, hf.heightAt(x, z), z, dtS);
        }
        const sample = lighting.apply(timeOfDay(state, alpha), camera.focus);
        night = sample.night;
        setGlowLevel(night);
        post.setNight(night);
        terrain.water.setTime(tS);
        terrain.water.setNight(night);
        terrain.water.setLight(sample.sunColor);
        entities.update(state, prev, alpha, tS, night);
        player.update(state, prev, alpha, tS, playerId);
        hearth.anim(tS, dtS, night);
      }
      renderer.info.reset();
      renderer.shadowMap.needsUpdate = true; // karede bir gölge geçişi
      post.render();
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    resize(w, h, dpr) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      const ratio = Math.min(dpr, RENDER.pixelRatioMax);
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      camera.resize(width, height);
      post.setSize(width, height, ratio); // composer aynı DPR ile (Retina'da post hedefleri düşük kalmasın)
    },
    pick(clientX, clientY) {
      if (!terrain) return null;
      ndc.set((clientX / width) * 2 - 1, -(clientY / height) * 2 + 1);
      ray.setFromCamera(ndc, camera.camera);
      const hit = ray.intersectObject(terrain.terrainMesh, false)[0];
      return hit ? { x: hit.point.x, z: hit.point.z } : null;
    },
    setBuildPreview(preview) {
      ghost?.set(preview);
    },
    setGridVisible(on) {
      if (terrain) terrain.gridLines.visible = on;
    },
    dispose() {
      clearWorld();
      glowPool.dispose();
      lighting.sun.dispose(); // gölge render hedefi
      glowTex.dispose();
      post.dispose();
      renderer.dispose();
    },
  };
}
