# Vanilla .XUI Engine - Dokümantasyon

**Vanilla .XUI Engine**, XML formatında tanımlanan kullanıcı arayüzlerini ve reaktif durumları (state) tarayıcı üzerinde dinamik olarak HTML DOM elemanlarına dönüştüren, bağımlılıksız (zero-dependency) ve hafif bir JavaScript kütüphanesidir.

---

## 📌 İçindekiler
- [Tüm Bileşenler Rehberi (`components.md`)](components.md)
- [Özellikler](#-özellikler)
- [Performans & Benchmark API](#-performans--benchmark-api)
- [React.js Karşılaştırması](#-reactjs-karşılaştırması)
- [Flexbox & Grid Düzen Motoru](#-flexbox--grid-düzen-motoru)
- [Dosya Boyutları ve Performans Metrikleri](#-dosya-boyutları-ve-performans-metrikleri)
- [Hızlı Başlangıç](#-hızlı-başlangıç)
- [Gelişmiş Özellikler ve Ekstra API'ler](#-gelişmiş-özellikler-ve-ekstra-apiler)
  - [1. AST İfade Ayrıştırıcı (`XUIExpressionParser`)](#1-ast-i̇fade-ayrıştırıcı-xuiexpressionparser)
  - [2. Özel Bileşen Kaydı (`registerComponent`)](#2-özel-bileşen-kaydı-registercomponent)
  - [3. Özel Aksiyon Kaydı (`registerAction`)](#3-özel-aksiyon-kaydı-registeraction)
- [XML Yapısı ve Etiketler](#-xml-yapısı-ve-etiketler)
- [Aksiyonlar ve Etkileşimler](#-aksiyonlar-ve-etkileşimler)

---

## 🚀 Özellikler

- **Sıfır Bağımlılık:** React, Vue veya derleyici gerektirmez; vanilla JavaScript ve standart DOM API'leri ile çalışır.
- **Yerleşik Flexbox & Grid Motoru:** Harici CSS kütüphanesine ihtiyaç duymadan `<flex>` ve `<grid>` etiketleri veya `direction`, `align`, `justify`, `gap`, `cols`, `rows`, `flex`, `col_span` öznitelikleri ile esnek arayüz tanımlama.
- **İnce Taneli (Fine-Grained) Reaktivite:** Tam sayfa render'ı ortadan kaldırarak sadece değişen DOM elemanlarını yerinde (in-place) güncelleme.
- **Deklaratif Auto-Init:** JavaScript kodu yazmadan `<script type="application/xui">` etiketi üzerinden otomatik başlama.
- **AST İfade Motoru:** Koşul ve şablon ifadelerinde mantıksal (`&&`, `||`, `!`), karşılaştırma ve fonksiyonel (`length()`, `contains()`) mantık.

---

## ⚡ Performans & Benchmark API

XUI Engine, sanal DOM (Virtual DOM) overhead'ini ortadan kaldırarak doğrudan standart tarayıcı DOM API'lerini kullanır. `Proxy` tabanlı **İnce Taneli (Fine-Grained) Reaktivite** sayesinde state değişikliklerinde sadece ve sadece ilgili DOM düğümü yerinde güncellenir.

### 💻 JavaScript Metod İle Çalıştırma

İstediğiniz zaman tarayıcı konsolundan veya JavaScript kodunuz içerisinden `XUIEngine.runBenchmark()` metodunu çağırabilirsiniz:

```javascript
// 1,000 elemanlık test çalıştırır (Konsola grafiksel tablo basar ve rapor döner)
const report = XUIEngine.runBenchmark(1000);

// İstenen eleman sayısıyla test (Örn. 5,000)
const bigReport = XUIEngine.runBenchmark(5000, "todos");

// Örnek Rapor Çıktısı:
// { count: 1000, durationMs: 4.8, opsPerSec: 208333, fineGrained: true, message: "..." }
```

| Benchmark Operasyonu | Ölçek (Item Count) | Süre (Milliseconds) | Açıklama |
| :--- | :--- | :--- | :--- |
| **İlk Yükleme & XML Mount** | 1 Komple Uygulama Spec | **< 2.5 ms** | XML parsing, Data Model & DOM ağacı oluşturma |
| **Toplu Eleman Ekleme (`PUSH`)** | **1,000 Eleman** | **~ 4.8 ms** | In-place DOM node ekleme (batch render) |
| **Büyük Ölçekli Ekleme (`PUSH`)** | **3,000 Eleman** | **~ 12.4 ms** | 3,000 karmaşık kartın sıfır donma ile eklenmesi |
| **Tekil İnce Taneli Güncelleme** | 1 Eleman State | **< 0.1 ms** | Sadece ilgili DOM düğümünün güncellenmesi |

---

## ⚛️ React.js Karşılaştırması

XUI Engine, React.js'e kıyasla sıfır karmaşıklık, derlemesiz çalışma ve hafiflik avantajları sunar:

| Mimari Kriter | ⚡ **Vanilla .XUI Engine** | ⚛️ **React.js** |
| :--- | :--- | :--- |
| **Çalışma Zamanı Boyutu** | **~8.6 KB Gzip** (Ultra hafif) | **~45 - 140 KB Gzip** |
| **Derleyici Gereksinimi** | **Gerekmez!** Doğrudan HTML/XML script etiketiyle çalışır | **Zorunlu** (Babel, Vite, Webpack, JSX transpilation) |
| **DOM Güncelleme Paradigması** | **Fine-Grained DOM Updates** (Doğrudan ilgili DOM düğümü yerinde güncellenir) | **Virtual DOM Reconciliation & Diffing** (Bileşen fonksiyonu yeniden yürütülür) |
| **State Yönetimi** | `Proxy` tabanlı otomatik reaktivite | `useState`, `useReducer`, Context veya external store |
| **Backend & CMS Uyumluluğu** | Sunucudan (PHP, Python, Go, Node vb.) dinamik XML üretilebilir | SSR / RSC altyapısı (Next.js, Remix) gerektirir |

---

## 📐 Flexbox & Grid Düzen Motoru

XUI Engine, esnek ve modern arayüzler tasarlamanız için yerleşik Flexbox ve Grid yapıları sunar.

### 1. Flexbox Yapısı (`<flex>`)
Doğrudan etiket veya component `type="flex"` olarak kullanılabilir:

```xml
<flex direction="row" align="center" justify="between" gap="16" wrap="true">
    <component type="title">Başlık</component>
    <flex direction="row" gap="8">
        <component type="button">Profil</component>
        <component type="button" class="secondary">Çıkış</component>
    </flex>
</flex>
```

**Kabul Edilen Öznitelikler:**
- `direction` / `dir`: `row` | `column` | `row-reverse` | `column-reverse`
- `align`: `start` (`flex-start`) | `center` | `end` (`flex-end`) | `stretch` | `baseline`
- `justify`: `start` | `center` | `end` | `between` (`space-between`) | `around` | `evenly`
- `gap`: `16` veya `16px` (sayı verildiğinde piksel birimi otomatik eklenir)
- `wrap`: `true` (`wrap`) | `false` (`nowrap`) | `wrap-reverse`

---

### 2. Grid Yapısı (`<grid>`)
Grid matris yerleşimleri oluşturmak için:

```xml
<grid cols="3" gap="12" class="my-grid">
    <for_each items="{data.pokemons}" var="poke">
        <flex direction="column" align="center" gap="4">
            <component type="image" src="{poke.image}" width="72" height="72" />
            <component type="text">#{poke.id} {poke.name}</component>
        </flex>
    </for_each>
</grid>
```

**Kabul Edilen Öznitelikler:**
- `cols` / `columns`: Sayı verildiğinde (örn. `3`) otomatik `repeat(3, minmax(0, 1fr))` üretir. Özel ölçü için `200px 1fr 2fr` girilebilir.
- `rows`: Sayı verildiğinde `repeat(N, minmax(0, 1fr))` üretir.
- `gap`: Izgara aralığı (örn. `12` veya `12px`)
- `gap_x` / `gap_y`: Sütun veya satır bazlı özel aralıklar.

---

### 3. Alt Eleman Düzen Öznitelikleri (Child Item Properties)
Herhangi bir alt bileşene verilebilen düzen öznitelikleri:
- `flex="1"`: Esnek büyüme/küçülme alanı (`flex: 1`)
- `col_span="2"`: Grid sütun kaplaması (`grid-column: span 2 / span 2`)
- `row_span="2"`: Grid satır kaplaması (`grid-row: span 2 / span 2`)

---

## 📊 Dosya Boyutları ve Performans Metrikleri

| Dosya | Açıklama | Ham Boyut | Gzip Boyutu |
| :--- | :--- | :--- | :--- |
| `dist/XUIEngine.umd.js` | Vite UMD Bundle (Önerilen) | **27.79 KB** | **8.68 KB** |
| `dist/XUIEngine.es.js` | Vite ES Module | **39.22 KB** | **9.72 KB** |
| `XUIEngine.min.js` | Minified Sürüm | **38.13 KB** | **9.38 KB** |
| `XUIEngine.js` | Kaynak Kod | **59.39 KB** | **11.24 KB** |

---

## 💻 Hızlı Başlangıç (Quick Start)

### Deklaratif HTML İçinde Kullanım (Auto-Init)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>XUI Flex & Grid Örneği</title>
</head>
<body>
    <div id="app"></div>

    <script type="application/xui" target="#app">
    <uid_spec id="layout_app">
        <data_model>
            <state id="username" type="string">Ahmet</state>
        </data_model>

        <flex direction="column" gap="16">
            <flex direction="row" justify="between" align="center">
                <component type="title">Hoş geldin, {data.username}!</component>
                <component type="button">Profil</component>
            </flex>
            <component type="text_input" bind="data.username" placeholder="İsminizi girin..." />
        </flex>
    </uid_spec>
    </script>

    <script src="XUIEngine.js"></script>
</body>
</html>
```

---

## 📌 Ref Mantığı (`ref="..."`) & Doğrudan DOM Erişimi

XUI Engine, harici DOM erişimi gerektiren durumlar için **Ref (Reference)** sistemini destekler. Any XML elemanına `ref="referansAdi"` eklendiğinde, oluşturulan canlı DOM nesnesi `engine.refs.referansAdi` altında saklanır.

### 1. XML İçerisinde Ref Tanımlama & Aksiyon Odaklama (Focus)

```xml
<flex direction="row" gap="8">
    <!-- input elemanına ref atama -->
    <component type="text_input" ref="todoInputRef" placeholder="Görev yazın..." />
    
    <!-- Butona tıklandığında ilgili ref'e odaklanma -->
    <component type="button">
        <label>Girdiye Odaklan</label>
        <on_click action="FOCUS" target="todoInputRef" />
    </component>
</flex>
```

### 2. JavaScript İle `engine.refs` Üzerinden DOM Erişimi

```javascript
const engine = await XUIEngine.mount(xmlText, "#app");

// Doğrudan DOM nesnesine erişim (HTMLInputElement)
const inputEl = engine.refs.todoInputRef;

// Native DOM metodlarını tetikleme
inputEl.focus();
inputEl.select();
console.log(inputEl.getBoundingClientRect());
```
