---
title: Chart.js Visuals Plugin
description: Declarative SVG & Canvas charts powered by Chart.js v4.x with reactive dataset synchronization.
order: 7
group: Plugins
---

# Chart Plugin (`euixjs/chart`)

The **Chart Plugin** brings declarative charting capabilities to EUIX, integrating seamlessly with Chart.js (v4.x) and synchronizing datasets with reactive state.

---

## 📊 Declarative Chart Definition (`<chart>`)

```xml
<uid_spec>
  <data_model>
    <state id="labels" type="array">["Jan", "Feb", "Mar", "Apr", "May"]</state>
    <state id="sales" type="array">[120, 190, 300, 500, 420]</state>
  </data_model>

  <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl max-w-xl">
    <h3 class="text-lg font-bold text-slate-800">Monthly Revenue</h3>
    
    <!-- Reactive Bar Chart -->
    <chart 
      type="bar" 
      labels="{data.labels}" 
      data="{data.sales}" 
      title="Sales ($k)" 
      class="w-full h-64" 
    />

    <button class="btn">
      <on_click action="MUTATE_STATE">
        <path>sales</path>
        <operation>PUSH</operation>
        <value>610</value>
      </on_click>
      Add June Data
    </button>
  </flex>
</uid_spec>
```

When `data.sales` is mutated via `MUTATE_STATE`, the chart instance animates the new data point automatically.

---

## 🧭 Next Step

Learn how to embed interactive GIS maps in **[Leaflet Maps Plugin](/plugins/leaflet)**.
