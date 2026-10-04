/** Render ayarları (Orta kalite). Oyun kuralı değil; sim content'e girmez. */
export const RENDER = {
  frustum: 24,
  isoDir: [1, 0.92, 1] as const,
  // max* değerleri BAŞLANGIÇ kapasitesidir; InstancedModel.ensureCapacity gerekirse büyütür (sessiz sınır yok).
  cameraDistance: 60,
  zoomMin: 0.6,
  zoomMax: 2.2,
  zoomStep: 0.1,
  /** Takip yumuşatma (1/s): focus += (hedef − focus) × (1 − e^(−k·dt)). */
  followRate: 6,
  pixelRatioMax: 2,
  shadowMapSize: 2048,
  shadowExtent: 20,
  maxCreatures: 512,
  maxNodes: 64,
  maxFences: 256,
  maxBuildings: 64,
  maxProjectiles: 128,
  maxGlowPools: 600,
  /** Yaratıklar gölge atmaz (gölge geçişinde 200×~550 üçgen tasarrufu; gece ay gölgesi zaten zayıf). */
  creatureShadows: false,
  /** Derin su hücreleri (dLand ≥ bu) arazi mesh'ine girmez; su shader'ı örter. Perf düğmesi. */
  terrainSkipDeep: 3,
  grassCount: 900,
  flowerCount: 300,
  pebbleCount: 120,
  /** Kaynak doğma animasyonu süresi (s) ve ok uçuş yüksekliği. */
  nodeGrowS: 0.7,
  arrowHeight: 1.6,
  axeSwingS: 0.5,
} as const;

/** F1 debug çizimleri (flow okları, çarpıştırıcılar, fener yarıçapı): renk, opaklık, yükseklik ofsetleri, ok oranları. */
export const DEBUG_VIEW = {
  opacity: 0.85,
  renderOrder: 20,
  flowColor: 0x8ff3ff,
  colliderColor: 0xffd75e,
  lanternColor: 0xffb24d,
  /** Flow okları zeminin bu kadar üstünde; çarpıştırıcı/fener çizgileri `groundLift` kadar. */
  arrowLift: 0.12,
  groundLift: 0.1,
  /** Ok gövdesi hücre vektörünün bu oranı kadar uzar; ok ucu kanatları bu oranda. */
  arrowShaft: 0.7,
  arrowHead: 0.15,
  /** Hücre kutusunun yarı kenarı. */
  cellHalf: 0.5,
  playerSegments: 16,
  creatureSegments: 10,
  lanternSegments: 32,
  /** Başlangıç kapasitesi (float); gerekirse ikinin katı olarak büyür. */
  minCapacity: 1024,
} as const;

/** İnşa önizlemesi (build-ghost): kare/hayalet renkleri, opaklıklar, boyutlar, çizim sırası. */
export const BUILD_GHOST = {
  maxCells: 64,
  renderOrder: 6,
  okColor: 0x6ce07a,
  badColor: 0xff5a4a,
  ghostOkColor: 0xb8f5c0,
  ghostBadColor: 0xffb0a8,
  okOpacity: 0.42,
  badOpacity: 0.48,
  ghostOpacity: 0.55,
  /** Kare kenarı (hücre 1.0; kenarlarda boşluk bırakır) ve zeminden yükseklik ofseti. */
  quadSize: 0.92,
  quadLift: 0.05,
} as const;
