# Gece Gelmeden — Tasarım Dokümanı (Spec)

- **Tarih:** 2026-10-03
- **Durum:** Taslak — kullanıcı onayı bekliyor
- **Sanat yönü referansı:** `prototypes/asset-kit/index.html` (onaylandı, 2026-10-03)

## 1. Özet

Tarayıcıda, linkle açılan, 1–4 kişilik **co-op izometrik hayatta kalma** oyunu. Gündüz ada
üzerinde odun/taş toplayıp savunma kurulur, gece yaratık dalgalarına karşı ortadaki **Ocak**
korunur. 7 gece hayatta kalınırsa run kazanılır. Run'lar arası küçük kalıcı açılımlar vardır.

Proje tamamen yapay zekâ ile geliştirilecek ("vibecoding"); bu yüzden **debug edilebilirlik,
otomatik test ve tekrar üretilebilirlik** baştan birinci sınıf gereksinimdir.

### Başarı ölçütleri

1. Arkadaşlar bir link açıp kurulum yapmadan 5 saniye içinde menüye ulaşır, oda kurar/bulur, lobiden birlikte oyuna girer.
2. 5–6 yıllık entegre GPU'lu bir dizüstünde oyun 60 FPS hedefler, 30 FPS'in altına düşmez.
3. 100–150 ms ping'de kendi karakter anında tepki verir; diğerleri akıcı görünür.
4. Bir hata oluştuğunda (çökme, desync veya oyuncunun F9 bildirimi) yeniden üretmek için gereken her şey (replay + loglar + ekran görüntüsü) otomatik toplanır.
5. Bir run 20–25 dk sürer ve "bir run daha" isteği uyandırır (playtest ile doğrulanır).

### Kapsam dışı (v1)

Oyun başladıktan sonra katılma (kopan oyuncu geri dönebilir), hesap sistemi, mobil/dokunmatik,
gamepad, birden fazla harita tipi, boss, sohbet, hile koruması, P2P/host-tarayıcı modu
(mimari buna izin verir ama v1'de yok).

## 2. Kararlar özeti

| Konu | Karar | Neden |
|---|---|---|
| Platform | Tarayıcı, sadece masaüstü (klavye + fare) | Link ile katılım; kontrol şeması basit |
| Dil | TypeScript (strict) her yerde | Tek dil, paylaşılan sim kodu |
| Render | Three.js (WebGL2; WebGPU sonra) | Hafif, en olgun web 3D; motor gerekmez çünkü sim sunucuda |
| UI | HTML/CSS üst katman | Hızlı üretim, kolay test |
| Sunucu | Node (LTS 24) + `ws` | Sim'i aynen çalıştırır |
| Netcode | Sunucu otoriter, 20 Hz; istemci tahmini (kendi hareketi) + interpolasyon | Co-op için yeterli, basit |
| Hosting | Fly.io, tek makine; sunucu istemci build'ini de servis eder | Ucuz, tek komut deploy, log erişimi |
| Monorepo | pnpm workspaces | Paket sınırları net |
| Test | Vitest (birim/sim), Playwright (e2e, perf, görsel) | Gerçek tarayıcıda çok istemcili test |
| Görsel stil | Low-poly izometrik 3D, kodla üretilen modeller, tek palet | Asset kit ile onaylandı |
| Fontlar | Baloo 2 (başlık/buton), Nunito (metin) — ikisi de Türkçe tam | Fredoka Türkçe karakterleri bozuyordu |

## 3. Oyun tasarımı

### 3.1 Run akışı

```
Lobi → [Gündüz 90 sn → Gece ~75 sn → Şafak kartı 15 sn] × 7 → Sonuç ekranı → Lobi
```

- **Ada:** Her run için seed'li prosedürel üretim; yarıçap ~22 birim, ortada düz **meydan** ve **Ocak**
  (bkz. 3.1.1). Run seed'i lobide gösterilir (debug için).
- **Kaybetme:** Ocak'ın canı 0 olursa run biter.
- **Kazanma:** 7. gecenin sonunda Ocak ayaktaysa.

### 3.1.1 Arazi ve yerleşim kuralları

- **Izgara tek gerçek kaynaktır.** Dünya 1×1 birimlik hücrelerden oluşur. Her hücrenin bir **katı** vardır:
  su, 1 (zemin) veya 2 (tepe). 3D arazi mesh'i bu ızgaradan üretilir; görülen yarlar sadece hücre
  kenarlarındadır, yani görüntü ile kurallar birebir aynıdır.
- **Ada büyük ölçüde düzdür:** oynanan alanın neredeyse tamamı tek zemin katıdır. Kumsal yar değil, sudan
  zemine yumuşak bir eğimdir (kıyıdan ~3 hücre). Zemin üzerinde seed'li 4–5 adet **küçük tepe**
  (3–6 hücre çapında, ~0.55 birim yüksek) vardır; her tepenin tek, 3 hücre genişliğinde bir **rampası** olur.
  Meydan (yarıçap ~7) daima zemin katıdır ve tepe meydana 1 hücreden yakın olamaz.
- **Hareket:** Zemin üzerinde serbest; **tepe yarları yürünmez**; tepeye çıkış sadece rampadan, rampanın
  yönünde. Oyuncu, yaratık ve yol bulma aynı kuralı kullanır. Rampalar açık renkli patika olarak görünür.
- **Bina yerleştirme:** Bina ayak izindeki tüm hücreler **aynı katta** ve boş olmalı. Kapalı hücreler: su,
  kumsal dalga çizgisi (suya < 2 hücre), rampa, Ocak çevresi (yarıçap ~2.6), ağaç/kaya/çalı/bina olan hücre.
  Ağaç ve kaya önce kesilir/kırılır ("alan açma"). Çitler tek tek hücre bazlı olduğu için katlar arasında
  devam edebilir; kule ve fener tek kat.
- **Döndürme:** Her bina 0°/90°/180°/270° yönlenebilir (`R` saat yönü, `Shift+R` ters). Ayak izi dönüşle
  birlikte döner (kare olmayan binalar için; v1 binaları kare olduğundan görsel yönü değiştirir: merdiven,
  fener kolu vb.). Tek başına konan çitin yönü de döner; sürüklenen çit hattının yönünü hat belirler.
- **Yerleştirme arayüzü:** İnşa modunda ızgara çizgileri görünür; ayak izi hücreleri yeşil/kırmızı yanar ve
  imleç yanında neden yazar ("Ağaç var — önce kes", "Farklı kat — yar kenarı", "Rampa — yol açık kalmalı"
  vb.). Çit: tıkla-sürükle ile düz hat; engelli hücreler atlanır.

### 3.2 Oyuncu

- WASD hareket, fare ile nişan. Kamera izometrik, yerel oyuncuyu yumuşak takip eder, zoom sınırlı, v1'de döndürme yok.
- **Balta** (tek alet): Sol tık → önündeki hedefe vurur. Ağaç → odun, kaya → taş, yaratık → hasar.
- **İnşa:** `1–3` ile bina seç, `R`/`Shift+R` ile döndür, hayalet önizleme farenin altında, sol tık yerleştir, sağ tık/Esc iptal.
  Geçerli/geçersiz konum renkle gösterilir. Kaynaklar **takımca ortak**.
- **Düşme / kaldırma:** Can 0 → oyuncu yere yığılır (ölmez). Bir takım arkadaşı yanında `E`'yi
  2 sn basılı tutarsa kalkar. Kimse kaldırmazsa şafakta Ocak yanında yeniden doğar.
- **Çarpışma:** Oyuncular, yaratıklar ve binalar daire/kutu çarpışmalıdır. Oyuncular birbirinin içinden geçmez (yumuşak itme).

### 3.3 Kaynaklar

- Haritada **sabit sayıda kaynak noktası**: başlangıç değeri 14 ağaç, 8 kaya.
- Bir nokta tükenince (ağaç devrilir / kaya kırılır) haritada **rastgele, boş ve inşa edilebilir bir hücrede**
  yenisi büyür: seed'li RNG (replay'de aynı yer), Ocak'tan en az ~7.5 birim uzak, etrafındaki 8 hücre boş
  ve rampa değil.
- Başlangıç verimi: ağaç 4 vuruşta devrilir → 3 odun; kaya 4 vuruşta kırılır → 2 taş.

### 3.4 Binalar (v1)

| Bina | Maliyet | İşlev |
|---|---|---|
| Çit | 5 odun | Yolu keser, yaratıkları oyalar; canı var |
| Ok Kulesi | 12 odun + 6 taş | Menzildeki en yakın yaratığa otomatik ok |
| Fener | 4 odun + 2 taş | Işık alanı: içindeki yaratıklar yavaşlar, Gölgecikler hasar alır |

Ocak da bir bina olarak modellenir (canı var, inşa edilemez).

**Izgara:** Tüm binalar 1×1 birimlik dünya ızgarasına oturur ve sadece 0°/90° yönlenir; çapraz/eğri
yerleşim yok. Çit 1 hücre kaplar ve komşu çitlere **otomatik bağlanır** (düz, köşe, T, artı
parçaları komşuluktan seçilir); tıkla-sürükle ile düz hat çekilir (maliyet hücre başına). Kule 2×2,
Fener 1×1. Yaratık yol bulma ızgarası aynı ızgaradır: bina = kapalı hücre(ler).

### 3.5 Yaratıklar (v1)

| Yaratık | Davranış | Hedef |
|---|---|---|
| Gölgecik | Hızlı, zayıf, sürü halinde | En yakın oyuncu, yoksa Ocak |
| Kütük | Yavaş, dayanıklı | En yakın bina (Ocak dahil) |
| Fenerböceği | Işığa koşar | En yakın Fener; söndürür (hasar verir) |

- Geceleri kıyıdaki sisten dalgalar halinde doğarlar. Sayı/güç gece numarası ve oyuncu sayısıyla ölçeklenir
  (formül içerik verisinde; denge aracıyla ayarlanır).
- **Yol bulma:** Bina ızgarasıyla aynı ızgara üzerinde **flow field** (Ocak'a ve hedef türlerine), bina eklenince/yıkılınca yeniden hesaplanır.
  Engelle sıkışan yaratık en yakın engele (çit) saldırır.
- Şafakta hayatta kalan yaratıklar dağılır.

### 3.6 Şafak kartları

Her şafakta havuzdan 3 kart gelir; her oyuncu oy verir (15 sn), çoğunluk kazanır, eşitlikte seed'li rastgele.
Başlangıç havuzu ≥ 8 kart, ör. "Çift Ok", "Keskin Balta (+%30 vuruş hızı)", "Geniş Hale (+%40 fener yarıçapı)",
"Sağlam Çit", "Ocak +25 can", "Hızlı Adım" vb. Kartlar içerik verisidir.

### 3.7 Kalıcı ilerleme (meta)

- **Kıvılcım:** Run sonunda hayatta kalınan her gece +N, kazanınca bonus.
- Açılımlar: **Okçu** (50 Kıvılcım; uzak saldırı), **Fenerci** (120; taşınabilir ışık), yeni kart/bina seçenekleri, küçük başlangıç bonusları.
- v1'de oyuncu başına `localStorage`'da saklanır (versiyonlu şema). Sunucuya taşıma sonraya.

### 3.8 İçerik veri olarak

Bina, yaratık, kart, karakter ve denge sabitleri `packages/sim/src/content/` altında tipli veri
tanımlarıdır. Yeni içerik = yeni tanım (+ model). Kod içinde sabit sayı ("magic number") yok.

## 4. Mimari

### 4.1 Paketler

```
game/
├─ packages/
│  ├─ sim/        Saf oyun mantığı. DOM/Three.js/ağ bilgisi YOK. Deterministik.
│  ├─ protocol/   Mesaj tipleri, sürüm, codec (başta JSON, arkasında arayüz)
│  ├─ client/     Vite + Three.js: render, input, tahmin, interpolasyon, HTML UI
│  ├─ server/     Node + ws: oda yönetimi, sim döngüsü, yayın, HTTP (/rooms, /health, statik dosyalar)
│  ├─ assets/     Kodla tanımlı modeller + palet + malzeme önbelleği (kit'ten taşınır)
│  └─ devtools/   Debug paneli, gecikme simülatörü, replay, log köprüsü
├─ tools/         Asset kit galerisi, replay oynatıcı, denge (bot) aracı
├─ tests/e2e/     Playwright senaryoları
├─ prototypes/    Onaylı asset kit (referans; ürün kodu değil)
└─ docs/
```

**Bağımlılık kuralları (ESLint ile zorlanır):** `sim` → hiçbir pakete bağlı değil.
`protocol` → `sim` tiplerini kullanabilir. `client`, `server` → `sim`, `protocol`.
`assets` → sadece `three`. `devtools` → `client`/`server` içine takılır, prod build'e girmez.

### 4.2 Sim (`packages/sim`)

- Sabit adım: **20 tick/sn** (50 ms). `step(state, inputs[]) → state` (+ olaylar listesi).
- Determinizm: Seed'li PRNG (Math.random yasak — lint kuralı), tick sayacı ile zaman, nesne
  iterasyon sırası sabit (id sıralı). Aynı seed + aynı girdi dizisi → aynı state hash.
- Durum: düz, serileştirilebilir veri (sınıf yok/az). Varlıklar id'li tablolar.
- Sistemler: ada/ızgara üretimi (3.1.1), hareket+çarpışma (yar/rampa kuralı), saldırı/hasar, kaynak toplama+yeniden doğma, inşa, gün/gece zamanlayıcı,
  dalga üretimi, flow field + yaratık AI, kule/fener etkileri, düşme/kaldırma, şafak oylaması, run sonu.
- Hareket fonksiyonu istemci tahmini için ayrı ve saf olarak export edilir.

### 4.3 Sunucu (`packages/server`)

- Tek süreç, çok oda. Oda = `{ kod, ad, görünürlük, host, oyuncular, durum: lobi|oyunda|sonuç, sim }`.
- Oda kodu: 4 harf, karışabilecek harfler hariç (O/0, I/1). Maks 4 oyuncu. Boş oda 5 dk sonra kapanır.
- Lobi: host lobiden çıkarsa host'luk sıradakine geçer; sadece host başlatır.
- HTTP: `GET /rooms` (herkese açık odalar), `GET /health`, istemci statik dosyaları (aynı origin, CORS yok).
- Oyun sırasında her tick: kuyruktaki girdileri uygula → `step` → delta snapshot yayınla.
- Girdi doğrulama: hız sınırı, menzil, kaynak yeterliliği. Bozuk mesaj → at + logla.

### 4.4 Ağ protokolü

- WebSocket (prod'da wss). Mesajlar `protocol` paketinde tipli; her mesajda tür alanı.
- Bağlanırken `hello { protocolVersion, sessionToken? }`; sürüm uyuşmazsa "Sayfayı yenile".
- İstemci → sunucu: `input { seq, tick, move, aim, actions }` her tick.
- Sunucu → istemci: `snapshot { tick, lastProcessedSeq, delta }` 20 Hz; ara sıra tam snapshot.
- **Tahmin:** İstemci kendi hareketini sim'in hareket fonksiyonuyla anında uygular; snapshot gelince
  onaylanmamış girdileri yeniden oynatır, küçük farkı yumuşatır, büyük farkta düzeltir.
- **Interpolasyon:** Diğer varlıklar ~100 ms geriden iki snapshot arasında.
- Saldırı animasyonu ve inşa önizlemesi anında (kozmetik); sonuçlar sunucu onaylı.
- Saat senkronu: ping/pong ile RTT ve ofset.
- Kopma: `sessionToken` sessionStorage'da; 60 sn içinde dönen oyuncu aynı karaktere bağlanır.
- Codec bir arayüzün arkasında: JSON ile başla; ölçüm bütçeyi aşarsa binary'ye geç.

### 4.5 İstemci (`packages/client`)

- Ekranlar (HTML): Ana menü (takma ad), Oda Kur, Oda Ara (liste + arama), Kodla Katıl,
  `/r/KODU` linki → takma ad → lobi, Lobi (oyuncular, karakter seçimi, kod + link kopyala, Başlat — sadece host),
  Oyun içi HUD, Şafak kartları, Sonuç ekranı. Görsel dil asset kit'teki taslaklardır.
- Render: sahne grafı sim state'inden türetilir (varlık id → görsel nesne). Tekrarlayan modeller
  `InstancedMesh`; statik ada tek/az geometri; tek palet malzemesi.
- Kamera: ortografik izometrik; yerel oyuncuyu takip.

## 5. Görsel ve asset hattı

Onaylı referans: `prototypes/asset-kit/index.html`.

- Modeller `packages/assets` içinde TS fonksiyonları: ilkel şekiller (yuvarlatılmış kutu, kapsül, koni,
  gürültüyle bozulmuş ikosahedron, ekstrüzyon) + seed'li varyasyon. Doku yok; renkler tek paletten.
- Ortam modelleri düz gölgeli (faceted), karakterler yumuşak gölgeli "oyuncak" oranlarında.
- Animasyon: kemiksiz, parça döndürme ile (yürüme, vuruş, el sallama, zıplama/ezilme).
- Arazi: ızgara kat haritasından üretilen mesh (hücre başına 4×4 alt bölüm, kenarlarda hafif organik bozulma),
  yüz bazlı renk (kum/çimen/yayla/yar şeritleri/rampa patikası/meydan toprağı), sığ-derin su + kıyı köpüğü shader'ı.
- Işık: tek gölge atan yönlü ışık (güneş/ay), yarım küre ışığı, gün saatinden türeyen renk anahtarları.
  Gece fenerleri prod'da **sahte ışık** (zemin halesi + emissive + bloom); gerçek nokta ışığı en fazla
  Ocak + birkaç tane.
- Post-process: GTAO (ortam gölgesi), bloom, **hafif** tilt-shift (vitrin/arayüzde kapalı). Hepsi kalite ayarından kapatılabilir.
- Kalite ön ayarları: Düşük / Orta / Yüksek (piksel oranı, gölge çözünürlüğü, AO, bloom, tilt-shift, çimen yoğunluğu).
- Asset kit sayfası `tools/kit` olarak kalıcı araç olur ve görsel regresyon testinin referansıdır.
- Ses (M4): jsfxr tarzı kodla üretilen efektler; müzik sonra.

## 6. Performans bütçeleri

| Metrik | Bütçe (Orta kalite, hedef cihaz) |
|---|---|
| Kare süresi | ≤ 16.6 ms (60 FPS), asla > 33 ms |
| Çizim çağrısı | ≤ 150 |
| Görünen üçgen | ≤ 500k |
| İstemci CPU / kare | ≤ 6 ms |
| Sunucu tick süresi (4 oyuncu, 200 yaratık) | ≤ 5 ms |
| İndirme (ilk açılış, gzip) | ≤ 2 MB JS+CSS |
| Bant genişliği / oyuncu | ≤ 40 KB/s |

Prototip kit bilinçli olarak optimize edilmedi (~2500 çizim çağrısı); bütçeler ürün kodu için geçerlidir.

## 7. Debug ve test altyapısı

### 7.1 Oyun içi araçlar (sadece dev build; `?debug` veya F1)

- Panel: FPS, kare süresi, çizim çağrısı, üçgen, bellek; ağ grafiği (RTT, snapshot boyutu, düzeltme sayısı, interp gecikmesi).
- Hileler: kaynak ver, ölümsüzlük, N. geceye atla, saati değiştir, yaratık doğur (tür, sayı), duraklat / tick tick ilerle, hız 0.5×/2×/10×.
- Görselleştirme: çarpışma şekilleri, flow field okları, yaratık hedefleri, fener yarıçapları.
- **Gecikme simülatörü:** gecikme, jitter, paket kaybı (istemci ve sunucu tarafında).

### 7.2 Debug köprüsü `window.__game` (dev build)

`getState()`, `cmd(name, ...args)` (ör. `cmd('spawn','golgecik',200)`), `setLag(ms, {jitter, loss})`,
`waitForTick(n)`, `snapshotHash()`. Playwright ve Claude in Chrome oyunu bununla okur/yönetir.

### 7.3 Loglama

- Sunucu: yapılandırılmış JSON log (pino), her satırda `room`, `tick`, `player`.
- Dev'de tüm tarayıcı konsolları sunucuya iletilir → tek dosya `logs/dev.log` (sunucu + tüm istemciler).
- Prod: `fly logs`. Hatalar oda/tick bağlamıyla.

### 7.4 Kayıt ve replay

- Sunucu her oda için seed + tick başına girdileri kaydeder (halka arabellek + run sonunda dosya).
- Tetikleyiciler: istisna, desync/tutarlılık kontrolü hatası, **F9 "Bug bildir"** → `bugs/<zaman>/` içine
  replay dosyası + ekran görüntüsü + son loglar + kısa not alanı.
- Replay aracı: headless olarak hedef tick'e kadar koşturur, state'i döker; istemcide izlenebilir.

### 7.5 Testler

| Katman | Araç | Kapsam |
|---|---|---|
| Birim | Vitest | Sim sistemleri, içerik doğrulama, codec gidiş-dönüş, tahmin/uzlaştırma (yapay gecikmeyle) |
| Determinizm | Vitest | Aynı seed+girdi iki kez → aynı hash; replay → aynı son state |
| Bot senaryoları | Vitest (headless) | Botlarla 7 gece run; çökme yok, istatistik üretir (denge aracının temeli) |
| E2E | Playwright | 2–4 tarayıcı: oda kur, listeden/linkle katıl, başlat, hareket, inşa, kopma-dönme; kötü ağ profiliyle |
| Performans | Playwright | Bütçe sahnesi (200 yaratık, 4 oyuncu, gece, tüm efektler); metrikler bütçeyi aşarsa kırmızı |
| Görsel | Playwright | Asset kit ekran görüntüsü karşılaştırması (toleranslı) |

- **`pnpm verify`**: tip kontrolü + lint + birim + determinizm + e2e (hızlı alt küme). Her iş bunu geçmeden bitmiş sayılmaz.
- Kod kalitesi: TS strict, ESLint (paket sınırları, Math.random yasağı sim'de), Prettier.
- Depoda `CLAUDE.md`: komutlar, mimari kuralları, debug köprüsü kullanımı, bug klasörü akışı.

## 8. Hata yönetimi

- Sunucu: oda içi istisna o odayı "hata" durumuna alır, replay kaydeder, oyunculara mesaj gösterir; süreç ayakta kalır.
- İstemci: yakalanmamış hata → debug overlay'de görünür + sunucuya log + F9 paketi önerisi.
- Bağlantı kopması: otomatik yeniden bağlanma (üstel bekleme), 60 sn içinde karaktere dönüş.
- Sürüm uyuşmazlığı: net mesaj ve yenile butonu.

## 9. Dağıtım

- Dockerfile: istemci build + sunucu tek imajda, `/health` kontrolü. M0'dan itibaren `pnpm docker:prod`
  ile prod imajı **yerelde Docker'da** çalıştırılıp test edilir (Docker Desktop kurulu).
- Dağıtım hedefi M5'te kesinleşir; varsayılan Fly.io (o aşamada flyctl kurulur). Imaj taşınabilir olduğu
  için AWS/VPS de mümkün. Ortam: `NODE_ENV`, `LOG_LEVEL`, `PUBLIC_URL`.
- Ön koşullar: pnpm (corepack ile, M0'ın ilk adımı). Node 24 ve Docker kurulu.

## 10. Aşamalar (her biri ayrı uygulama planı)

| Aşama | İçerik | Bitti sayılır |
|---|---|---|
| **M0 Temel** | Monorepo, TS/ESLint/Prettier, Vitest, Playwright, `pnpm dev`/`verify`, log köprüsü, `window.__game` iskeleti, boş sahne servis eden sunucu, Dockerfile + yerel prod testi, CLAUDE.md | `pnpm verify` yeşil; tarayıcıda boş sahne + debug paneli; Docker imajı yerelde açılıyor |
| **M1 Tek oyunculu çekirdek** | Sim: ızgara/ada üretimi, hareket/çarpışma (yar/rampa), toplama + kaynak yeniden doğma, inşa, gün/gece, yaratıklar + flow field, Ocak; render (kit'ten taşınan assetler, instancing), HUD, debug araçları | Tek başına 1 gece oynanabilir; bütçe sahnesi testi var |
| **M2 Multiplayer** | Sunucu odaları, menü/oda ara/lobi akışı, tahmin + interpolasyon, gecikme simülatörü, kopma-dönme | 4 tarayıcılı e2e yeşil; 150 ms'de akıcı |
| **M3 Run döngüsü** | 7 gece, şafak kartları + oylama, düşme/kaldırma, sonuç ekranı, replay + F9, bot/denge aracı, oyun hissi (vuruş sallanması, partiküller, hasar sayıları) | Uçtan uca run oynanır; replay hatayı yeniden üretir |
| **M4 Meta ve içerik** | Kıvılcım, Okçu/Fenerci, kalite ön ayarları, ses efektleri | Açılımlar çalışır; düşük ayarda bütçe tutar |
| **M5 Yayın** | Dağıtım hedefi seçimi (varsayılan Fly.io) + deploy, perf geçişi, arkadaşlarla playtest | Link dışarıdan çalışır; playtest notları |

## 11. Açık konular (uygulamayı engellemez)

- Denge sayıları (süreler, maliyetler, dalga formülü) bot aracı ve playtest ile ayarlanacak; spec'teki değerler başlangıç değeridir.
- Oyunun adı "Gece Gelmeden" çalışma adıdır.
