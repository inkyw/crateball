# Gece Gelmeden

Tarayıcıda linkle açılan, 1–4 kişilik co-op izometrik hayatta kalma oyunu. Tamamen yapay zekâ ile geliştiriliyor.

- Tasarım: `docs/superpowers/specs/2026-10-03-gece-gelmeden-design.md` — her işten önce ilgili bölümü oku.
- Planlar: `docs/superpowers/plans/` (aşama başına bir plan: M0 → M5).
- Onaylı sanat yönü: `prototypes/asset-kit/index.html` (referans; ürün kodu değil). `python3 -m http.server 8765 -d prototypes/asset-kit` ile aç.

## Bu makinede kabuk

zsh profili `node/npm/npx/pnpm/corepack` adında kendini çağıran nvm fonksiyonları tanımlıyor. Her komutu şu önekle çalıştır:

```sh
unset -f node npm npx pnpm pnpx corepack 2>/dev/null; export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH";
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Sunucu (3000) + istemci (5173). Tarayıcı: `http://localhost:5173/?debug` |
| `pnpm verify` | format + typecheck + lint + birim + e2e. **Bir iş bunu geçmeden bitmiş sayılmaz.** |
| `pnpm test` / `pnpm e2e` | Sadece Vitest / sadece Playwright |
| `pnpm build` | `dist/client` + `dist/server/server.mjs` |
| `pnpm docker:prod` | Prod imajını yerelde kurup smoke testini koşar (`docker smoke OK`) |

## Mimari kuralları (lint ile zorlanır)

- `packages/sim`: saf ve deterministik. `Math.random`, `Date`, DOM, `three`, `ws`, `node:*`, diğer `@gg/*` yasak. Rastgelelik `createRng(seed)`, karşılaştırma `hashState`.
- `packages/protocol`: sadece `@gg/sim`'e bağlı olabilir. Ağdan gelen her şey `decode*` ile doğrulanır.
- `packages/client` sunucuya, `packages/server` render koduna bağlanamaz.
- `packages/devtools` yalnızca `import.meta.env.DEV` dalında yüklenir; prod paketine girmez (`pnpm docker:prod` kontrol eder).
- Paketler TS kaynağını doğrudan export eder; kütüphane build adımı yok.

## Debug akışı

- Tüm loglar tek dosyada: `logs/dev.log` (sunucu + her tarayıcının konsolu, `"src":"client"` ile).
- `window.__game` (dev): `getState()`, `cmd(name, ...args)`, `commands()`. Playwright ve Claude in Chrome ile oyunu buradan oku/yönet; ekran görüntüsünden tahmin etme.
- F1 veya `?debug`: FPS, CPU ms/kare, çizim çağrısı, üçgen, bağlantı durumu.
- Hata ayıklarken önce `logs/dev.log` ve `__game.getState()`; sonra test ile yeniden üret.

## Bug klasörü (spec §7.4; F9 ile otomatik üretim M3'te gelir)

- Düzen: `bugs/<YYYY-MM-DD_HH-MM-SS>/` → `replay.json` (seed + tick başına girdiler), `screenshot.png`, `logs.txt` (son loglar), `note.md` (oyuncunun notu).
- Kullanıcı "F9'a bastım" ya da "bug bildirdim" derse: en yeni `bugs/` klasörünü oku → replay aracıyla hedef tick'e kadar ekransız koştur → hatayı test olarak yaz → düzelt.
- M0–M2'de bu klasör henüz üretilmez; o zamana kadar `logs/dev.log` + `__game` kullan.

## Kurallar

- Oyuncunun gördüğü her metin Türkçe. Fontlar Baloo 2 + Nunito (Fredoka değil: Türkçe glifleri bozuk).
- Kod tanımlayıcıları İngilizce; log mesajları Türkçe olabilir.
- Commit mesajları sade İngilizce, kanban id yok (kişisel proje).
- Docker CLI takılırsa: `osascript -e 'quit app "Docker"'; open -a Docker`. Hiçbir şeyi silme/prune etme.
