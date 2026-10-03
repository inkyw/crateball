# M1 — Tek oyunculu çekirdek: karar notları

Ana spec'e (`2026-10-03-gece-gelmeden-design.md`) ek. Spec'in bıraktığı uygulama seçimlerini sabitler. Oyunda görünen adlar spec §1.1 sözlüğündeki İngilizce adlardır; kodda da İngilizce tanımlayıcılar kullanılır (`hearth`, `shadeling`, `stumpkin`, `glowbug`, `woodcutter`, `fence`, `arrowTower`, `lantern`).

## Hedef (M1 bitti sayılır)

Tarayıcıda `pnpm dev` → `http://localhost:5173` açılınca oyuncu doğrudan (menü/lobi yok — M2) tek kişilik bir run'a girer: adada yürür, ağaç keser/taş kırar, çit/kule/fener kurar, ilk gece yaratık dalgalarına karşı Hearth'ı korur. Gece bitince şafak gelir ve gün 2 başlar (kartlar, 7 gece hedefi, düşme/kaldırma M3). Hearth sönerse "The Hearth went out" ekranı + "Try again". Performans bütçe testi var.

## Mimari

- **Yerel oturum:** M1'de sim tarayıcıda, ana thread'de çalışır (`LocalSession`): sabit 20 Hz adım (accumulator), render iki tick arasında interpolasyon yapar. Sunucu M1'de oyun çalıştırmaz (sadece dev log + statik). M2'de `LocalSession` yerine aynı arayüzle `NetSession` gelir — bu yüzden istemci sim'e sadece `step(state, inputs) → { state, events }` ve okuma fonksiyonları üzerinden dokunur.
- **Sim tamamen saf ve deterministik** (M0 kuralları). Gürültü fonksiyonu (value noise/fbm) sim içinde, seed'li. Durum düz JSON (hashState ile karşılaştırılabilir). Varlıklar id'li tablolar, iterasyon id sırasıyla.
- **Içerik veri olarak:** `packages/sim/src/content/` — bina, yaratık, oyuncu, kaynak, dalga ve zaman sabitleri; kodda sihirli sayı yok.
- **Assetler:** `packages/assets` (yeni paket, sadece `three`'ye bağlı): asset kit'teki model fonksiyonları TS'e taşınır + **bake**: bir modelin tüm parçaları malzeme rengi köşe rengine yazılarak tek `BufferGeometry`'ye birleştirilir (opak parçalar) + ayrı bir emissive geometri (gözler, alev, fener camı). Tek paylaşılan `MeshStandardMaterial({ vertexColors })` ve tek emissive malzeme.
- **Çizim bütçesi (≤150 çağrı):** ağaç (çam/meşe), kaya, çalı, çimen, her yaratık türü (gövde + parlayan parça) `InstancedMesh`; ada arazisi tek mesh; çitler komşu maskesine göre 16 varyant geometri, varyant başına `InstancedMesh`; kule/fener baked tek geometri, tür başına `InstancedMesh`. Karakterler (≤4) çok parçalı kalabilir. Yaratık animasyonu instance matrisi ile (zıplama/ezilme/sallanma), parça animasyonu yok.

## Oyun kuralları ve başlangıç sayıları (content'te, sonra dengelenecek)

- **Ada:** kit'teki ızgara üretimi (64×64 hücre, yarıçap ~22, meydan r=7 zemin, 4–5 küçük tepe + tek rampa, kıyı yumuşak eğim) sim'e taşınır; seed'li. Hearth meydan ortasında 2×2.
- **Oyuncu (Woodcutter):** hız 4 u/s, daire çarpıştırıcı r=0.35, can 100. Ölünce 5 sn sonra Hearth yanında yeniden doğar (M3'te düşme/kaldırma ile değişecek).
- **Balta:** sol tık, bekleme 0.5 sn, önündeki 100° yayda 1.3 birim menzil. Ağaç/kaya: 4 vuruş → 3 wood / 2 stone. Yaratık: 12 hasar.
- **Kaynaklar:** sabit 14 ağaç, 8 kaya; tükenen yeniden doğar (spec §3.3, kit kuralları). Başlangıç kaynağı: 10 wood, 0 stone.
- **Binalar:** Fence 5 wood, can 60, 1×1, otomatik bağlanma, sürükleyerek hat; Arrow Tower 12 wood + 6 stone, can 150, 2×2, menzil 7, 1 ok/sn, 10 hasar; Lantern 4 wood + 2 stone, can 40, 1×1, ışık yarıçapı 4: içindeki yaratık %40 yavaş, Shadeling 3 hasar/sn alır. Hearth can 500. Döndürme R/Shift+R. Yerleştirme kuralları kit ile aynı (aynı kat, kumsal/rampa/Ocak çevresi kapalı, kaynak üstüne konmaz).
- **Zaman:** gündüz 90 sn, gece 75 sn; gece sayacı. Debug'da hızlandırma.
- **Yaratıklar:** gece başında + gece boyunca kıyı hücrelerinde (su komşusu, Hearth'tan ≥14) dalgalar halinde doğar. Gece 1: 3 dalga (0, 25, 50. sn): Shadeling 6/4/6, Stumpkin 0/1/1, Glowbug 1/1/2. Sonraki geceler ×(1 + 0.35·(n−1)). Şafakta kalanlar dağılır (yok olur).
  - Shadeling: hız 3.2, can 20, 6 birimde oyuncu görürse ona, yoksa flow field ile Hearth'a; temas hasarı 8/sn.
  - Stumpkin: hız 1.4, can 120, en yakın binaya (Hearth dahil) flow field; vuruş 20 hasar/1.5 sn.
  - Glowbug: hız 2.6, can 15, en yakın Lantern'a (yoksa Hearth); vuruş 10 hasar/sn.
- **Yol bulma:** ızgara üzerinde flow field (Dijkstra) hedefe: geçilebilir hücreler + rampa kuralı (kit `canStep`); binalar geçilmez ama "yüksek maliyetli" (maliyet 8) sayılır → yol kapalıysa yaratık önündeki binaya saldırır. Bina eklenince/yıkılınca yeniden hesaplanır. Yaratıklar birbirini hafif iter (ayrışma).
- **Ok kulesi mermisi:** sim'de projectile varlığı (hız 14), hedefe güdümlü.

## İstemci

- Kamera: ortografik izometrik (kit açısı), oyuncuyu yumuşak takip, tekerlekle zoom (0.6–2.2).
- Girdi: WASD, fare ile nişan (zemin düzlemi raycast), sol tık balta, `1–3` bina seçimi → inşa modu (ızgara çizgileri + yeşil/kırmızı önizleme + neden ipucu, kit ile aynı), `R`/`Shift+R`, sağ tık/Esc iptal; çit sürükleme.
- HUD (HTML, kit HUD stili, İngilizce): wood/stone, "Day 1"/"Night 1" + kalan süre çubuğu, Hearth can çubuğu, oyuncu can çubuğu, inşa hotbar'ı (maliyet, yetersizse sönük), "The Hearth went out" + "Try again".
- Görsel: kit'in ışık/gece-gündüz, su shader'ı, son işlemler (AO/bloom/hafif tilt-shift) ve sahte ışık havuzları; kalite ön ayarı şimdilik tek (Orta).
- Ses yok (M4).

## Debug (dev)

`window.__game` komutları: `give(wood, stone)`, `skipTo('day'|'night')`, `timeScale(x)`, `pause()`/`resume()`/`step(n)`, `spawn(type, n, near?)`, `god(on)`, `seed()`, `hash()`; `getState()` özet (tick, phase, night, player, hearth, entity sayıları, render istatistikleri). F1 paneline: flow field okları, çarpıştırıcılar, ızgara, fener yarıçapı aç/kapa.

## Testler

- Sim birim: ada üretimi (determinizm, kat/rampa değişmezleri), hareket/çarpışma (yar geçilmez, rampa geçilir), toplama + yeniden doğma, inşa kuralları + maliyet, gün/gece geçişi, dalga üretimi, flow field (kapalı yolda binaya yönelme), yaratık hasarı, kule atışı, Hearth ölümü → game over; determinizm (aynı seed + girdi → aynı hash, 5 dk simülasyon).
- E2E: oyun açılır ve oynanır (WASD ile hareket konumu değiştirir, ağaca vurunca wood artar, çit kurulur, `skipTo('night')` sonrası yaratık doğar, Hearth ölünce game over ekranı).
- **Performans:** Playwright'ta `spawn('shadeling', 200)` + gece + tüm efektler: `renderer.info` çizim çağrısı ≤150 ve üçgen ≤500k **zorunlu**; kare süresi kaydedilir (headless GPU'da süre güvenilmez, sadece raporlanır).
