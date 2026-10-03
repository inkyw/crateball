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
