---
title: Leaflet GIS Maps Plugin
description: Declarative interactive maps, markers, polygons, and GIS layers with reactive coordinate state sync.
order: 8
group: Plugins
---

# Leaflet Maps Plugin (`euixjs/leaflet`)

The **Leaflet Plugin** allows you to embed declarative, interactive GIS maps and synchronize markers, polygons, and popups with EUIX state.

---

## 🗺️ Declarative Map (`<leaflet_map>`)

```xml
<uid_spec>
  <data_model>
    <state id="mapLat" type="number">39.9208</state>
    <state id="mapLng" type="number">32.8541</state>
    <state id="zoom" type="number">12</state>
    <state id="selectedCity">Ankara, Turkey</state>
  </data_model>

  <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl max-w-2xl">
    <div class="flex justify-between items-center">
      <h3 class="font-bold text-slate-800">Location: {data.selectedCity}</h3>
      <span class="text-xs text-slate-400">Lat: {data.mapLat}, Lng: {data.mapLng}</span>
    </div>

    <!-- Declarative Leaflet Container -->
    <leaflet_map 
      lat="{data.mapLat}" 
      lng="{data.mapLng}" 
      zoom="{data.zoom}" 
      class="w-full h-80 rounded-xl overflow-hidden border"
    >
      <marker lat="{data.mapLat}" lng="{data.mapLng}" title="{data.selectedCity}" />
    </leaflet_map>

    <!-- Update Coordinates Reactively -->
    <flex direction="row" gap="8">
      <button class="btn">
        <on_click action="SET_STATE"><path>data.mapLat</path><value>41.0082</value></on_click>
        <on_click action="SET_STATE"><path>data.mapLng</path><value>28.9784</value></on_click>
        <on_click action="SET_STATE"><path>data.selectedCity</path><value>Istanbul, Turkey</value></on_click>
        Jump to Istanbul
      </button>
      <button class="btn">
        <on_click action="SET_STATE"><path>data.mapLat</path><value>38.4192</value></on_click>
        <on_click action="SET_STATE"><path>data.mapLng</path><value>27.1287</value></on_click>
        <on_click action="SET_STATE"><path>data.selectedCity</path><value>Izmir, Turkey</value></on_click>
        Jump to Izmir
      </button>
    </flex>
  </flex>
</uid_spec>
```

When `data.mapLat` or `data.mapLng` changes, the Leaflet map smoothly pans to the new location and moves the marker.

---

## 🧭 Next Step

Learn about date and currency formatting in **[Date & Intl Plugin](/plugins/date)**.
