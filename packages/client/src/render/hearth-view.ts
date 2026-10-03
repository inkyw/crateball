import { type HearthModel, type HeightField, makeHearth } from '@gg/assets';
import { HEARTH_POS } from '@gg/sim';
import type { Scene, Texture } from 'three';

export interface HearthView {
  model: HearthModel;
  anim(tS: number, dtS: number, night: number): void;
  dispose(): void;
}

export function createHearthView(scene: Scene, hf: HeightField, glowTex: Texture | null): HearthView {
  const model = makeHearth(glowTex);
  model.group.position.set(HEARTH_POS.x, hf.heightAt(HEARTH_POS.x, HEARTH_POS.z), HEARTH_POS.z);
  scene.add(model.group);
  return {
    model,
    anim: (t, dt, night) => model.anim(t, dt, night),
    dispose() {
      model.dispose(); // sahneden çıkarır + geometriler/kıvılcım malzemesi
    },
  };
}
