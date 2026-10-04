# M0'dan devredilen küçük notlar (M1 backlog)

M0 incelemelerinde "Minor" olarak işaretlenip ertelenen maddeler. M1 planı yazılırken gözden geçirilecek.

## Araçlar / lint
- `eslint.config.js`: `tseslint.config()` typescript-eslint 8.71'de deprecated → `defineConfig` (`eslint/config`).
- `globals.node` tüm dosyalara uygulanıyor; sadece server, config dosyaları ve `tests/**` ile sınırla.
- Göreli yolla paket dışına çıkma (`../../server/...`) lint ile yakalanmıyor (bilinçli; plan kararı).
- Boundaries izin testleri `not.toContain` yerine `toEqual([])` kullanmalı; `import './net'` için regresyon testi.

## Sunucu
- `LOG_LEVEL` doğrulanmadan `pino.Level`'a çevriliyor.
- `sirv`'de `/assets` için `maxAge` + `immutable` (M5 öncesi).
- Başlangıçtan sonra kalıcı `wss` 'error' dinleyicisi yok (hata uncaughtException ile süreci bitirir).
- `/__log` LAN IP ve `[::1]` origin'lerine 403 döner (dev için bilinçli).
- M2: WebSocket `Origin` kontrolü (CORS WS'yi kapsamaz).
- Testler: HEAD/diğer metotlar statik yollarda, geçerli JSON + geçersiz alanlı WS mesajı.

## İstemci
- `net.close()` gerçek soketlerde status'u eşzamansız `onclose`'a bırakıyor; `onStatus('connecting')` `connect()` dönmeden çağrılıyor; çift `closed` bildirimi.
- `resize()` yükseklik 0'da NaN aspect; `dispose()` geometri/materyal sızdırıyor.
- three paketi 533 kB chunk uyarısı → assetler gelince `manualChunks` (bütçe 2 MB içinde).
- `fonts.gstatic.com` preconnect eksik; `vite/client` tipleri iki kez referanslanıyor.
- HMR'de log köprüsü iki kez kurulabilir.

## Testler
- `BACKOFF_MS[0]` sabitini doğrulayan anlamsız assert; `attempts`/`clientId` sıfırlanması test edilmiyor; ikili (Blob/ArrayBuffer) mesaj yok sayma testi yok.
- e2e: `LOG_FILE` cwd'ye göreli; sürüm uyuşmazlığı testinde sabit 1.5 sn bekleme; overlay testlerinde DOM temizliği.

## Sim
- `stableStringify` sadece düz JSON (doküman yorumu eklendi); `formatArgs` `toString` atan nesnede patlayabilir (devtools).

## M1'de ele alınanlar
- İstemci: Vite `codeSplitting.groups` (three ayrı chunk), `fonts.gstatic.com` preconnect, `resize()` yükseklik 0, `dispose()` sızıntıları (sahip olunan geometri/doku/pass'ler açıkça bırakılır; Task 19 restart döngüsü testi `renderer.info.memory` ile doğrular) — Task 16/17/19.
- Lint: `tseslint.config` → `defineConfig`; `globals.node` yalnızca sunucu/config/test dosyalarında — Task 1.

## M1'den devredilenler (M2+)
- Shadeling aurası ve Glowbug kanatları instancing için opak taşındı; saydam varyant (ayrı malzeme, 2 çağrı) değerlendirilebilir.
- Kule bayrağı dalgalanmaz (instanced); Hearth alevleri grup ölçeğiyle animasyonlu (kit'te alev başına).
- Çalılar baltayla temizlenir (2 vuruş, verim yok); kit'te yalnızca dekor.
- Kaynak düşme/devrilme ve "+3" pop metni animasyonları (kit `removeNode`, `popText`) M3 oyun hissi işine bırakıldı.
- Yaratık ölüm/doğum efekti yok (yalnızca büyüme ölçeği).
- `LocalSession.setInput` her karede çağrılır; M2 `NetSession` için girdi `seq` numarası eklenecek.

## M1 incelemelerinden ertelenen minörler

### M2 öncesi zorunlu
- Sim (build komutu): güvenilmeyen komut sayıları doğrulanmıyor (tam sayı olmayan/sonlu olmayan `i`/`j`, `slice` öncesi çok uzun çit hattı, `rot` zorlanmıyor) → M2 `NetSession`'dan önce doğrula.
- Sunucu: WebSocket `Origin` kontrolü (yukarıda M0 notu; M2).

### sim
- `secondsToTicks` yuvarlama testinde kesirli girdi yok.
- Arazi: `randomFreeCell` için `maxR`/`gap`/null durumları test edilmiyor.
- Flow: birden çok rotalı ağırlıklı karşılaştırma testi yok.
- Hareket: çapraz kayma testi hiç çarpışmıyor; sınır testi `clampWorld` olmadan da geçiyor.
- Build: kule için ilk olmayan hücre hatası ve `MAX_FENCE_LINE` testi yok.
- Yaratık/oyuncu: şafakta mermi temizliği testi (Task 11 notu; fix turunda kapsanmış olabilir).

### assets
- Genel: `createGlowPool` testi yok; `geometry.test.ts`'te ölü satır; "power of two" yorumu kesin değil; `ensureCapacity` değiştirmede `visible`/`renderOrder` kopyalamıyor; modül yüklenirken `setGlowLevel(0)`.
- Çit: z-kolu maskeleri test edilmiyor. Dispose testi yalnızca `not.toThrow`; kıvılcım ömrü sarması test edilmiyor; `LANTERN_GLASS_INTENSITY` fazladan export; çimen/çiçek/çakıl opak döngüde değil.
- Karakterler: kullanılmayan glowbug seed hack'i; shadeling squash sert adım; negatif `t`'de çukur; ince animasyon testleri; `VillagerModel.dispose` yok (oyuncu yeniden kurulursa yeniden kullan).
- Işık/su: su `sun` siyah başlar (`setNight` `setLight`'tan önce çağrılırsa gündüz tonu kararır); 420 su düzlemi ve 192 doku sabit; `createLighting`/`apply` testsiz; `sampleKeys` paylaşılan nesne döndürüyor.

### client
- `LocalSession`: `skipTo` bekleyen girdiyi tüketiyor; duraklatılmışken girdi kilitleri kalıyor; `onBlur` bayat sürüklemeyi bırakıyor; Esc sonrası `attackHeld` devam ediyor; `HOTBAR` cast; test boşlukları (basılı tutma tekrarı, blur, null hover geri dönüşü).
