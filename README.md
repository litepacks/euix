# Vanilla .XUI Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Tool: Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF.svg)](https://vitejs.dev/)
[![Minifier: Terser](https://img.shields.io/badge/Minifier-Terser-FF6B6B.svg)]()
[![Dependencies: Zero](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg)]()

**Vanilla .XUI Engine**, XML formatında bildirimsel (declarative) olarak tanımlanan kullanıcı arayüzlerini ve reaktif durumları (state) tarayıcı üzerinde doğrudan HTML DOM elemanlarına dönüştüren, bağımlılıksız (zero-dependency) ve yüksek performanslı bir JavaScript kütüphanesidir.

---

## 📦 Paket Boyutları & Terser Optimization

Terser 3-pass AST sıkıştırması ve Rollup Tree-Shaking optimizasyonları sayesinde paket boyutlarında **%26.6 net küçülme** elde edilmiştir:

| Dağıtım Dosyası | Format / Açıklama | Ham Boyut (Raw) | Sıkıştırılmış (Gzip) | Düşüş Oranı |
| :--- | :--- | :--- | :--- | :--- |
| **`XUIEngine.min.js`** | **Standalone Terser Minified (Önerilen)** | **28.00 KB** (28,668 B) | **8.32 KB** (8,515 B) | 📉 **-%26.6 (10.3 KB Tasarruf)** |
| **`dist/XUIEngine.umd.js`** | **Vite / Rollup UMD Bundle** | **28.14 KB** (28,818 B) | **8.42 KB** (8,620 B) | 📉 **-%26.1 (10.1 KB Tasarruf)** |
| **`dist/XUIEngine.es.js`** | **Vite ES Module** | **58.56 KB** (59,967 B) | **11.79 KB** (12,074 B) | 🌳 Tree-Shakable |
| **`XUIEngine.js`** | **Geliştirme / Kaynak Kod** | **61.44 KB** (62,912 B) | **11.95 KB** (12,237 B) | - |

> 🌳 **Tree-Shaking:** ESM projelerinde sadece ihtiyaç duyulan modüller (örn: sadece `XUIExpressionParser`) içe aktarıldığında kullanılmayan kodlar pakete dahil edilmez ve paket boyutu **~1.8 KB Gzip** seviyesine kadar düşer.

---

## ⚡ Performans & Benchmark API

XUI Engine, sanal DOM (Virtual DOM) katmanını atlayarak doğrudan standart tarayıcı DOM API'lerini kullanır. Proxy tabanlı **İnce Taneli (Fine-Grained) Reaktivite** sayesinde state değişikliklerinde sadece ve sadece ilgili DOM düğümü yerinde güncellenir.

### 🛠️ JavaScript API İle Canlı Benchmark Çalıştırma

Geliştiriciler istedikleri zaman konsoldan veya JS kodları içerisinden benchmark çalıştırabilirler:

```javascript
// 1,000 elemanlık benchmark testi (Konsola tablo ve metrik basar)
const report = XUIEngine.runBenchmark(1000);
console.log(report.durationMs, report.opsPerSec);

// İstenilen boyutta test (Örn: 5,000 eleman)
XUIEngine.runBenchmark(5000);

// Veya aktif engine örneği (instance) üzerinden:
engine.runBenchmark(2000, "todos");
```

| Benchmark Operasyonu | Ölçek (Item Count) | Süre (Milliseconds) | Açıklama |
| :--- | :--- | :--- | :--- |
| **İlk Yükleme & XML Mount** | 1 Komple Uygulama Spec | **< 2.5 ms** | XML parsing, Data Model & DOM ağacı oluşturma |
| **Toplu Eleman Ekleme (`PUSH`)** | **1,000 Eleman** | **~ 4.8 ms** | In-place DOM node ekleme (batch render) |
| **Büyük Ölçekli Ekleme (`PUSH`)** | **3,000 Eleman** | **~ 12.4 ms** | 3,000 karmaşık kartın sıfır donma ile eklenmesi |
| **Tekil İnce Taneli Güncelleme** | 1 Eleman State | **< 0.1 ms** | Sadece ilgili DOM düğümünün güncellenmesi |

---

## 🆚 Vanilla .XUI Engine vs React.js

XUI Engine, React.js'e kıyasla sıfır karmaşıklık, derlemesiz çalışma ve son derece hafif bir çalışma ortamı sunar:

| Özellik / Kriter | ⚡ **Vanilla .XUI Engine** | ⚛️ **React.js** |
| :--- | :--- | :--- |
| **Bağımlılık (Dependencies)** | ⚡ **0 Bağımlılık** (Zero Dependency) | 📦 `react`, `react-dom` + onlarca build bağımlılığı |
| **Çalışma Zamanı Boyutu** | 🪶 **~8.3 KB Gzip** | 🏋️ **~45 KB - 140 KB Gzip** |
| **Derleme (Build Step)** | 🚫 **Gerekmez!** `<script>` etiketi ile doğrudan çalışır | ⚙️ **Zorunlu** (Babel, JSX, Vite/Webpack, SWC) |
| **Reaktivite & Re-render** | 🎯 **İnce Taneli (Fine-Grained)** DOM güncellemesi | 🔄 **Virtual DOM Diffing** & Bileşen re-render |
| **Sözdizimi & Format** | 📜 **Standart XML & HTML** | ⚛️ **JSX (JavaScript XML)** |
| **Öğrenme Eğrisi** | 🚀 **Çok Düşük** (XML ve HTML öznitelik bilgisi yeterli) | 📈 **Orta-Yüksek** (Hooks, Closure gotchas, VDOM) |
| **Sunucu (CMS / Backend) Eşleşmesi** | 🌐 Sunucudan (PHP, Node, Python, Go) doğrudan XML basılabilir | ⚛️ SSR / RSC (Next.js) gibi karmaşık sunucu katmanları gerektirir |

---

## 🚀 Öne Çıkan Özellikler

- ⚡ **Sıfır Bağımlılık (Zero Dependency):** Herhangi bir derleyici veya harici CSS kütüphanesi gerektirmez. Saf Vanilla JavaScript ile çalışır.
- 📐 **Yerleşik Flexbox & Grid Motoru:** `<flex>` ve `<grid>` etiketleri ile `direction`, `align`, `justify`, `gap`, `cols`, `rows`, `flex`, `col_span` parametrelerini doğrudan XML içerisinde tanımlama.
- ⚡ **İnce Taneli (Fine-Grained) Reaktivite:** State güncellemelerinde tüm kapsayıcıyı re-render etmek yerine sadece etkilenen DOM düğümlerini yerinde (in-place) güncelleme.
- 📜 **Deklaratif Auto-Init:** JavaScript kodu yazmadan `<script type="application/xui">` etiketleri üzerinden otomatik başlatma.
- 🧮 **AST İfade Motoru (`XUIExpressionParser`):** Koşul ve şablon ifadelerinde mantıksal (`&&`, `||`, `!`), karşılaştırma ve fonksiyonel (`length()`, `contains()`) mantık.
- 🧩 **Modüler Registry API:** `registerComponent()` ve `registerAction()` metodları ile özel bileşen ve aksiyonlar tanımlama.

---

## 💻 Hızlı Başlangıç (Quick Start)

### 1. Flex & Grid Layout Kullanım Örneği (Auto-Init)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>XUI Flex & Grid Örneği</title>
</head>
<body>
    <div id="app"></div>

    <!-- XML Şablonu -->
    <script type="application/xui" target="#app">
    <uid_spec id="layout_app">
        <data_model>
            <state id="username" type="string">Ahmet</state>
        </data_model>

        <flex direction="column" gap="16">
            <flex direction="row" justify="between" align="center">
                <component type="title">Merhaba, {data.username}!</component>
                <component type="button">Profil</component>
            </flex>
            <grid cols="2" gap="12">
                <component type="text_input" bind="data.username" placeholder="İsim..." />
                <component type="button" class="secondary">Kaydet</component>
            </grid>
        </flex>
    </uid_spec>
    </script>

    <!-- XUI Engine (Auto-Init Otomatik Çalışır) -->
    <script src="XUIEngine.js"></script>
</body>
</html>
```

### 2. Statik Helper İle Çalıştırma

```javascript
XUIEngine.mount(appXml, "#app");
```

### 3. Ref (`ref="..."`) ve Doğrudan DOM Erişimi

Herhangi bir elemana `ref="myRef"` vererek `engine.refs.myRef` ile doğrudan HTML DOM nesnesine erişebilir veya XML içerisinden `<on_click action="FOCUS" target="myRef" />` kullanabilirsiniz:

```xml
<component type="text_input" ref="nameInput" placeholder="Adınızı girin..." />
<component type="button">
    <label>Odaklan</label>
    <on_click action="FOCUS" target="nameInput" />
</component>
```

```javascript
const engine = await XUIEngine.mount(appXml, "#app");
engine.refs.nameInput.focus(); // HTMLInputElement nesnesi
```

---

## 📖 Geniş Dokümantasyon

- Tüm kapsayıcılar, UI bileşenleri ve aksiyon rehberi için **[components.md](components.md)** dosyasını,
- Flexbox & Grid parametreleri, state mutasyonları (`PUSH`, `UNSHIFT`, `UPDATE`, `REMOVE`) ve mimari detaylar için **[docs.md](docs.md)** dosyasını inceleyebilirsiniz.

---

## 📄 Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır.
