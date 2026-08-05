# Vanilla .XUI Engine - Bileşenler Rehberi (`components.md`)

Bu doküman, **Vanilla .XUI Engine** tarafından desteklenen tüm yerleşim kapsayıcılarını, UI bileşenlerini, kontrol akış etiketlerini, aksiyonları, evrensel olay dinleyicilerini (`<event>`) ve özel bileşen kayıt sistemini detaylı olarak sunar.

---

## 📌 İçindekiler
- [1. Yerleşim ve Kapsayıcı Bileşenleri](#1-yerleşim-ve-kapsayıcı-bileşenleri-layout--containers)
- [2. Temel UI Bileşenleri (`<component type="...">`)](#2-temel-ui-bileşenleri-component-type)
- [3. Mantıksal ve Akış Etiketleri (Logic & Control Flow)](#3-mantıksal-ve-akış-etiketleri-logic--control-flow)
- [4. Evrensel Olay Dinleyicileri (`<event>`) ve Aksiyonlar](#4-evrensel-olay-dinleyicileri-event-ve-aksiyonlar)
- [5. Özel Bileşen ve Aksiyon Kaydı (Registry API)](#5-özel-bileşen-ve-aksiyon-kaydı-registry-api)

---

## 1. 📐 Yerleşim ve Kapsayıcı Bileşenleri (Layout & Containers)

### `<flex>`
Esnek Flexbox kapsayıcısı. `display: flex` ile çalışır.

**Öznitelikler:**
- `direction` / `dir`: `row` | `column` | `row-reverse` | `column-reverse`
- `align`: `start` (`flex-start`) | `center` | `end` (`flex-end`) | `stretch` | `baseline`
- `justify`: `start` | `center` | `end` | `between` (`space-between`) | `around` | `evenly`
- `gap`: Piksel birimi cinsinden aralık (Örn: `gap="16"`)
- `wrap`: `true` (`wrap`) | `false` (`nowrap`) | `wrap-reverse`

```xml
<flex direction="row" align="center" justify="between" gap="16" class="p-4 bg-white">
    <component type="title">Başlık</component>
    <component type="button">İşlem</component>
</flex>
```

---

### `<grid>`
Izgara matris kapsayıcısı. `display: grid` ile çalışır.

**Öznitelikler:**
- `cols` / `columns`: Sütun sayısı (Örn: `cols="3"` -> `repeat(3, minmax(0, 1fr))`) veya özel grid tanımı (`cols="200px 1fr"`)
- `rows`: Satır sayısı veya tanımı
- `gap`: Izgara aralığı (`gap="12"`)
- `gap_x` / `gap_y`: Sütun veya satır bazlı aralıklar

```xml
<grid cols="3" gap="12" class="p-4">
    <component type="text">Kutu 1</component>
    <component type="text">Kutu 2</component>
    <component type="text">Kutu 3</component>
</grid>
```

---

### `<collapse>`
Durum tabanlı açılır/kapanır akordeon paneli.

**Öznitelikler:**
- `bind`: Açık/kapalı durumunu tutan state yolu (Örn: `bind="data.todos_open"`)
- `title`: Panel başlığı (Alternatif olarak `<summary>` etiketi kullanılabilir)
- `header_class`: Başlık butonuna verilecek CSS sınıfları
- `body_class`: Panel gövdesine verilecek CSS sınıfları

```xml
<collapse bind="data.panel_open" title="Detaylar" class="border rounded-xl">
    <component type="text">Açılır panel içeriği...</component>
</collapse>
```

---

### `<dialog>`
Durum tabanlı modal pencere bileşeni. Escape ve arka plan (backdrop) tıklaması ile kapatılabilir.

**Öznitelikler:**
- `bind`: Görünürlük durumunu tutan state yolu (Örn: `bind="data.help_open"`)
- `title`: Dialog başlığı
- `backdrop_class`: Arka plan karartma CSS sınıfları
- `panel_class`: İç modal kartı CSS sınıfları

```xml
<dialog bind="data.help_open" title="XUI Bilgilendirme">
    <component type="text">Modal pencere içeriği...</component>
    <actions>
        <component type="button">
            <label>Kapat</label>
            <event type="click" action="SET_STATE">
                <path>data.help_open</path>
                <value>false</value>
            </event>
        </component>
    </actions>
</dialog>
```

---

## 2. 🧩 Temel UI Bileşenleri (`<component type="...">`)

| Bileşen Tipi (`type`) | HTML Elemanı | Öne Çıkan Öznitelikler / Alt Etiketler | Örnek Kullanım |
| :--- | :--- | :--- | :--- |
| **`title`** | `html h2` | `class` | `<component type="title">Başlık</component>` |
| **`text`** | `span` | `bind`, `<template>` | `<component type="text" bind="data.username" />` |
| **`text_input`** | `<input type="text">` | `bind`, `placeholder`, `autofocus` | `<component type="text_input" bind="data.input_val" placeholder="Yazın..." />` |
| **`checkbox`** | `<input type="checkbox">` | `bind` | `<component type="checkbox" bind="todo.completed" />` |
| **`button`** | `<button>` | `<label>`, `<event>` | `<component type="button"><label>Ekle</label></component>` |
| **`image`** | `<img>` | `src`, `alt`, `width`, `height` | `<component type="image" src="{poke.image}" width="64" />` |
| **`flex` / `grid`** | `<div>` | `direction`, `cols` vb. | `<component type="flex" direction="row">...</component>` |

---

## 3. 🔀 Mantıksal ve Akış Etiketleri (Logic & Control Flow)

### `<data_model>` ve `<state>`
Reaktif durum modelini tanımlar.

```xml
<data_model>
    <state id="username" type="string">Ahmet</state>
    <state id="counter" type="number">0</state>
    <state id="todos" type="array">
        <item id="1" text="Görev 1" completed="false" />
    </state>
</data_model>
```

---

### `<if>`, `<else_if>`, `<else>`
Koşullu render blokları.

```xml
<if condition="{todo.completed} == true">
    <component type="text" class="line-through">{todo.text}</component>
    <else>
        <component type="text" class="font-bold">{todo.text}</component>
    </else>
</if>
```

---

### `<for_each>`
Dizi elemanlarını dinamik ve reaktif olarak render eder.

```xml
<for_each items="{data.todos}" var="todo">
    <flex direction="row" gap="8">
        <component type="checkbox" bind="todo.completed" />
        <component type="text">{todo.text}</component>
    </flex>
</for_each>
```

---

## 4. ⚡ Evrensel Olay Dinleyicileri (`<event>`) ve Aksiyonlar

XUI Engine, tek bir tıklama etiketine bağımlı kalmak yerine tüm DOM olaylarını destekleyen evrensel bir olay dinleme mimarisi sunar:

### Evrensel Olay Etiketi (`<event type="...">` / `<on name="...">`)

**Desteklenen Olay Türleri (`type` / `name`):**
- `click` (Tıklama)
- `change` / `input` (Değişim)
- `keyup` / `keydown` (Klavye basımları — `key="Enter"` veya `key="Escape"` filtreli)
- `mouseenter` / `mouseleave` / `hover` (Fare hareketleri)
- `submit` (Form gönderimi — Otomatik `preventDefault` uygular)

**Kullanım Örnekleri:**

```xml
<!-- 1. Tıklama Olayı (Doğrudan Action Özniteliği İle) -->
<component type="button">
    <label>Kaydet</label>
    <event type="click" action="SET_STATE">
        <path>data.status</path>
        <value>saved</value>
    </event>
</component>

<!-- 2. Klavye Enter Basımı Olayı -->
<component type="text_input" bind="data.new_todo">
    <event type="keyup" key="Enter" action="MUTATE_STATE">
        <path>data.todos</path>
        <operation>PUSH</operation>
        <value><item text="{data.new_todo}" /></value>
    </event>
</component>

<!-- 3. Fare Üzerine Geldiğinde (Hover / MouseEnter) -->
<flex direction="row">
    <event type="mouseenter" action="SET_STATE">
        <path>data.is_hovered</path>
        <value>true</value>
    </event>
</flex>
```

> 💡 **Kısayol Etiketleri:** Geriye dönük uyumluluk ve pratiklik için `<on_click>`, `<on_change>`, `<on_submit>`, `<on_keyup>` etiketleri de `<event type="...">` karşılığı olarak doğrudan desteklenmektedir.

---

### Aksiyon Tipleri (`action="..."`)

#### `SET_STATE`
Tekil durum değerini günceller ve opsiyonel odağı (`focus`) ayarlar.

```xml
<event type="click" action="SET_STATE">
    <path>data.editing_id</path>
    <value>{todo.id}</value>
    <focus>data.edit_input</focus>
</event>
```

#### `MUTATE_STATE`
Diziler üzerinde performanslı mutasyonlar gerçekleştirir (`PUSH`, `UNSHIFT`, `UPDATE`, `REMOVE`).

```xml
<event type="click" action="MUTATE_STATE">
    <path>data.todos</path>
    <operation>UPDATE</operation>
    <where field="id" equals="{todo.id}" />
    <fields text="{data.edit_input}" />
</event>
```

#### `XHR`
Asenkron API isteği atıp sonucu state'e kaydeder.

```xml
<event type="click" action="XHR">
    <method>GET</method>
    <url>https://api.example.com/data</url>
    <target>data.results</target>
</event>
```

---

## 5. 💡 Özel Bileşen ve Aksiyon Kaydı (Registry API)

```javascript
// Özel Bileşen Kaydı:
engine.registerComponent('badge', (xmlNode, context, engine) => {
    const span = document.createElement('span');
    span.className = 'px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full';
    span.textContent = engine.interpolate(xmlNode.textContent, context);
    return span;
});

// Özel Aksiyon Kaydı:
engine.registerAction('TOAST', (actionNode, context, engine) => {
    const msg = engine.interpolate(actionNode.textContent, context);
    alert('Toast Bildirimi: ' + msg);
});
```
