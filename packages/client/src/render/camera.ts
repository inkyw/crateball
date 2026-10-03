import { OrthographicCamera, Vector3 } from 'three';
import { RENDER } from './config';

export interface FollowCamera {
  camera: OrthographicCamera;
  /** Takip edilen nokta (ışık ve gölge kamerası da buraya odaklanır). */
  focus: Vector3;
  readonly zoom: number;
  setZoom(z: number): void;
  update(tx: number, ty: number, tz: number, dtS: number): void;
  resize(width: number, height: number): void;
}

const ISO = new Vector3(...RENDER.isoDir).normalize().multiplyScalar(RENDER.cameraDistance);

export function createFollowCamera(): FollowCamera {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const focus = new Vector3(0, 1, 0);
  const target = new Vector3();
  const place = () => {
    camera.position.copy(focus).add(ISO);
    camera.lookAt(focus);
  };
  place();
  return {
    camera,
    focus,
    get zoom() {
      return camera.zoom;
    },
    setZoom(z) {
      camera.zoom = Math.min(RENDER.zoomMax, Math.max(RENDER.zoomMin, z));
      camera.updateProjectionMatrix();
    },
    update(tx, ty, tz, dtS) {
      target.set(tx, ty, tz);
      const k = 1 - Math.exp(-RENDER.followRate * Math.max(0, dtS));
      focus.lerp(target, k);
      place();
    },
    resize(width, height) {
      const aspect = width / Math.max(1, height);
      camera.left = (-RENDER.frustum * aspect) / 2;
      camera.right = (RENDER.frustum * aspect) / 2;
      camera.top = RENDER.frustum / 2;
      camera.bottom = -RENDER.frustum / 2;
      camera.updateProjectionMatrix();
    },
  };
}
