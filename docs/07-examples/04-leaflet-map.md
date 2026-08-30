---
title: Leaflet Interactive Map Example
description: Embedding interactive maps with custom markers and dynamic coordinates bound to reactive state.
order: 4
group: Examples
---

# Leaflet Interactive Map Example

This example demonstrates how to embed a responsive Leaflet map, pan between locations, and synchronize reactive state with GIS coordinates.

---

## ⚡ Complete Application Code

```xml
<uid_spec>
  <!-- 1. State Definition -->
  <data_model>
    <state id="currentCity">Paris</state>
    <state id="lat" type="number">48.8566</state>
    <state id="lng" type="number">2.3522</state>
    <state id="zoom" type="number">13</state>
  </data_model>

  <!-- 2. UI Layout -->
  <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-2xl mx-auto">
    <flex direction="row" justify="between" align="center">
      <div>
        <h2 class="text-xl font-bold text-slate-800">Explore Cities</h2>
        <p class="text-xs text-slate-400">Selected: {data.currentCity} ({data.lat}, {data.lng})</p>
      </div>

      <!-- Quick Jump Buttons -->
      <flex direction="row" gap="6">
        <button class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
          <on_click action="SET_STATE"><path>data.lat</path><value>48.8566</value></on_click>
          <on_click action="SET_STATE"><path>data.lng</path><value>2.3522</value></on_click>
          <on_click action="SET_STATE"><path>data.currentCity</path><value>Paris</value></on_click>
          Paris
        </button>
        <button class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
          <on_click action="SET_STATE"><path>data.lat</path><value>51.5074</value></on_click>
          <on_click action="SET_STATE"><path>data.lng</path><value>-0.1278</value></on_click>
          <on_click action="SET_STATE"><path>data.currentCity</path><value>London</value></on_click>
          London
        </button>
        <button class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
          <on_click action="SET_STATE"><path>data.lat</path><value>40.7128</value></on_click>
          <on_click action="SET_STATE"><path>data.lng</path><value>-74.0060</value></on_click>
          <on_click action="SET_STATE"><path>data.currentCity</path><value>New York</value></on_click>
          New York
        </button>
      </flex>
    </flex>

    <!-- Declarative Map Container -->
    <leaflet_map 
      lat="{data.lat}" 
      lng="{data.lng}" 
      zoom="{data.zoom}" 
      class="w-full h-80 rounded-xl overflow-hidden border border-slate-200"
    >
      <marker lat="{data.lat}" lng="{data.lng}" title="{data.currentCity}" />
    </leaflet_map>
  </flex>
</uid_spec>
```

---

## 🧭 Next Example

See how to expose tools to AI agents in **[WebMCP AI Agent Tooling Example](/examples/webmcp-agent)**.
