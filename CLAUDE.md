# Crateball

Tarayıcıda linkle açılan, haxball tarzı 3v3 arcade futbol: kutulardan silah/mayın/buz çıkar,
oyuncuların mevkileri var. Tamamen yapay zekâ ile geliştiriliyor.

- Tasarım ve ağ modeli: `docs/design.md` — her işten önce oku.
- Eski proje (Before Nightfall) git geçmişinde, `before-nightfall` etiketinde duruyor.

## Bu makinede kabuk

zsh profili `node/npm/npx/pnpm/corepack` adında kendini çağıran nvm fonksiyonları tanımlıyor. Her komutu şu önekle çalıştır:

```sh
unset -f node npm npx pnpm pnpx corepack 2>/dev/null; export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH";
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Sunucu (3000) + istemci (5173). Tarayıcı: `http://localhost:5173/?name=Y` (menü), `?name=Y&autoplay&debug` (oda kurup hemen başlatır), `/r/KOD?name=Z` (katıl) |
| `pnpm verify` | format + typecheck + lint + birim + e2e. **Bir iş bunu geçmeden bitmiş sayılmaz.** |
| `pnpm test` / `pnpm e2e` | Sadece Vitest / sadece Playwright |
| `pnpm build` | `dist/client` + `dist/server/server.mjs` |
| `pnpm docker:prod` | Prod imajını yerelde kurup smoke testini koşar (`docker smoke OK`) |

## Mimari kuralları (lint ile zorlanır)

- `packages/sim`: saf ve deterministik oyun (fizik, kutular, botlar, mevkiler). `Math.random`, `Date`, DOM, `ws`, `node:*`, diğer `@crateball/*` yasak. Rastgelelik durumdaki `rng` alanından (`nextRandom`), karşılaştırma `hashState`. Trig fonksiyonu kullanma (motorlar arası determinizm).
- `packages/protocol`: yalnızca `@crateball/sim` tiplerine bağlı. Ağdan gelen her şey `decode*` ile doğrulanır.
- `packages/server`: odalar (`rooms.ts`: kod, host, lobi/maç durumu, botlar, takas), 60 Hz tick, girdi kuyruğu, 30 Hz snapshot, `GET /rooms`. Render koduna bağlanamaz.
- `packages/client`: Canvas 2D (`render.ts`), tahmin/geri sarma (`predict.ts`), menü/lobi DOM (`ui.ts`), olay çıkarımı (`events.ts`) → ses (`sound.ts`) + parçacık (`particles.ts`), klavye (`input.ts`). Sunucuya bağlanamaz.
- `packages/devtools` yalnızca `import.meta.env.DEV` dalında yüklenir; prod paketine girmez.
- Oyun sabitleri yalnızca `packages/sim/src/content/rules.ts`; renkler `packages/client/src/render.ts` başında.

## Debug akışı

- Tüm loglar tek dosyada: `logs/dev.log` (sunucu + tarayıcı konsolu, `"src":"client"`).
- `window.__game` (dev): `getState()` → `{ frame, screen, room, net(rtt), render(particles), pred(pending, corrections), sim(...) }`; `cmd('fx', 'mine'|'ice'|'goal'…)` efekt dener. F1: FPS, bağlantı+RTT, bekleyen girdi, düzeltme sayısı.
- Gecikme denemesi (yalnızca dev): URL'ye `&lag=100&jitter=20` ekle (tek yön ms; ping ≈ 2×lag). F1'de RTT/pending/corrections. Otomatik test: `tests/e2e/multiplayer.spec.ts` içindeki `withLatency`.
- Determinizm: aynı seed + aynı girdi → aynı `hashState`; şüphede `packages/sim/test/game.test.ts`.

## Kurallar

- Oyuncunun gördüğü her metin **İngilizce**. Fontlar Baloo 2 + Nunito.
- Kod tanımlayıcıları İngilizce; log mesajları Türkçe olabilir.
- Commit mesajları sade İngilizce, kanban id yok (kişisel proje).
- Docker CLI takılırsa: `osascript -e 'quit app "Docker"'; open -a Docker`. Hiçbir şeyi silme/prune etme.
