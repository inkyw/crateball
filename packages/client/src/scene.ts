import * as THREE from 'three';

export interface RenderStats {
  calls: number;
  triangles: number;
}

export interface GameScene {
  render(): RenderStats;
  resize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

const FRUSTUM = 24;
/** Asset kit ile aynı izometrik açı (prototypes/asset-kit). */
const ISO = new THREE.Vector3(1, 0.92, 1).normalize().multiplyScalar(60);

export function createScene(canvas: HTMLCanvasElement): GameScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0f2);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.copy(ISO);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xcdebff, 0x8a7a5a, 1.2));
  const sun = new THREE.DirectionalLight(0xfff4e0, 3);
  sun.position.set(20, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 15, 1, 48),
    new THREE.MeshStandardMaterial({ color: 0x76b552, roughness: 0.95 }),
  );
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  // M1'de asset kit'teki gerçek Ocak modeline geçilecek; şimdilik yer tutucu.
  const ocak = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.1, 7),
    new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xff6a2a, emissiveIntensity: 1.2 }),
  );
  ocak.position.y = 0.55;
  ocak.castShadow = true;
  scene.add(ocak);

  return {
    render() {
      renderer.render(scene, camera);
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    resize(width, height, pixelRatio) {
      renderer.setPixelRatio(Math.min(pixelRatio, 2));
      renderer.setSize(width, height, false);
      const aspect = width / height;
      camera.left = (-FRUSTUM * aspect) / 2;
      camera.right = (FRUSTUM * aspect) / 2;
      camera.top = FRUSTUM / 2;
      camera.bottom = -FRUSTUM / 2;
      camera.updateProjectionMatrix();
    },
    dispose() {
      renderer.dispose();
    },
  };
}
