import { type HeightField, PAL, type VillagerModel, makeVillager } from '@gg/assets';
import type { GameState } from '@gg/sim';
import { Mesh, type Scene } from 'three';
import { RENDER } from './config';
import type { PoseSnapshot as PrevPositions } from '@gg/sim';

export interface PlayerView {
  model: VillagerModel;
  update(state: GameState, prev: PrevPositions, alpha: number, tS: number, playerId: number): void;
  dispose(): void;
}

export function createPlayerView(scene: Scene, hf: HeightField): PlayerView {
  const model = makeVillager({ color: PAL.p1, hat: 'beanie', seed: 1 });
  scene.add(model.group);
  return {
    model,
    update(state, prev, alpha, tS, playerId) {
      const p = state.players[playerId];
      if (!p || p.dead) {
        model.group.visible = false;
        return;
      }
      model.group.visible = true;
      const q = prev.players[playerId];
      const x = q ? q.x + (p.x - q.x) * alpha : p.x;
      const z = q ? q.z + (p.z - q.z) * alpha : p.z;
      model.group.position.set(x, hf.heightAt(x, z), z);
      model.group.rotation.y = p.yaw;
      const swingAge = (state.tick + alpha - p.swingTick) / 20;
      const moving = q ? Math.hypot(p.x - q.x, p.z - q.z) > 1e-4 : false;
      if (swingAge < RENDER.axeSwingS) model.setState('chop');
      else model.setState(moving ? 'walk' : 'idle');
      model.anim(tS, Math.min(1, swingAge / RENDER.axeSwingS));
    },
    dispose() {
      scene.remove(model.group);
      model.group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose(); // malzemeler paylaşılır
      });
    },
  };
}
