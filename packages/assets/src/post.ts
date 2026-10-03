import {
  type Camera,
  HalfFloatType,
  type Scene,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { lerp } from './noise';

export interface PostToggles {
  ao?: boolean;
  bloom?: boolean;
  tilt?: boolean;
}
export interface PostPipeline {
  composer: EffectComposer;
  /** Mantıksal boyut + sınırlandırılmış piksel oranı (renderer ile aynı değer). */
  setSize(w: number, h: number, pixelRatio: number): void;
  setNight(night: number): void;
  setEnabled(t: PostToggles): void;
  getEnabled(): Required<PostToggles>;
  render(): void;
  /** Composer hedefleri ve TÜM pass'ler (GTAO, bloom, tilt, output) bırakılır. */
  dispose(): void;
}
/** Kit ayarları: GTAO (0.7/1.5/1.2/1.1/16, 0.85), bloom (0.4/0.55/0.92; gece 0.85), hafif tilt-shift (0.9 px). */
export const POST_SETTINGS = {
  gtao: { radius: 0.7, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 16 },
  gtaoBlend: 0.85,
  bloom: { strength: 0.4, radius: 0.55, threshold: 0.92, dayStrength: 0.3, nightStrength: 0.85 },
  tiltAmount: 0.9,
} as const;

export function createPostPipeline(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  width: number,
  height: number,
): PostPipeline {
  const rt = new WebGLRenderTarget(width, height, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const gtao = new GTAOPass(scene, camera, width, height);
  gtao.updateGtaoMaterial({ ...POST_SETTINGS.gtao });
  gtao.blendIntensity = POST_SETTINGS.gtaoBlend;
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(
    new Vector2(width, height),
    POST_SETTINGS.bloom.strength,
    POST_SETTINGS.bloom.radius,
    POST_SETTINGS.bloom.threshold,
  );
  composer.addPass(bloom);
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  const output = new OutputPass();
  /** Tilt uniformları piksel bazlı: gerçek hedef boyutu = mantıksal × DPR. */
  const sizeTilt = (w: number, h: number, dpr: number) => {
    tiltH.uniforms.h!.value = POST_SETTINGS.tiltAmount / (w * dpr);
    tiltV.uniforms.v!.value = POST_SETTINGS.tiltAmount / (h * dpr);
    tiltH.uniforms.r!.value = tiltV.uniforms.r!.value = 0.5;
  };
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  composer.addPass(output);
  const passes = [renderPass, gtao, bloom, tiltH, tiltV, output];
  const apply = (w: number, h: number, dpr: number) => {
    // Composer saklanan DPR ile çarpar; renderer ile aynı sınırlandırılmış değer verilmeli (M0 backlog: Retina).
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    sizeTilt(w, h, dpr);
  };
  apply(width, height, renderer.getPixelRatio());
  return {
    composer,
    setSize: apply,
    setNight(night) {
      bloom.strength = lerp(POST_SETTINGS.bloom.dayStrength, POST_SETTINGS.bloom.nightStrength, night);
    },
    setEnabled(t) {
      if (t.ao !== undefined) gtao.enabled = t.ao;
      if (t.bloom !== undefined) bloom.enabled = t.bloom;
      if (t.tilt !== undefined) tiltH.enabled = tiltV.enabled = t.tilt;
    },
    getEnabled() {
      return { ao: gtao.enabled, bloom: bloom.enabled, tilt: tiltH.enabled && tiltV.enabled };
    },
    render() {
      composer.render();
    },
    dispose() {
      for (const p of passes) p.dispose();
      composer.dispose();
      rt.dispose();
    },
  };
}
