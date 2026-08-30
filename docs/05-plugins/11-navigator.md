---
title: Hardware & Navigator Plugin
description: Reactive browser capabilities including online/offline detection, battery status, geolocation, and clipboard.
order: 11
group: Plugins
---

# Navigator Plugin (`euixjs/navigator`)

The **Navigator Plugin** integrates native browser and device hardware capabilities directly into EUIX reactive state.

---

## 📡 Declarative Configuration (`<navigator_config>`)

```xml
<uid_spec>
  <data_model>
    <state id="isOnline" type="boolean">true</state>
    <state id="batteryLevel" type="number">100</state>
  </data_model>

  <!-- Bind hardware status to reactive state -->
  <navigator_config 
    bind_online="isOnline" 
    bind_battery="batteryLevel" 
  />

  <flex direction="column" gap="8" class="p-6">
    <div class="p-3 rounded-lg {data.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
      Network: {data.isOnline ? '🟢 Connected' : '🔴 Offline'}
    </div>
    
    <p>Battery: <strong>{data.batteryLevel}%</strong></p>
  </flex>
</uid_spec>
```

---

## 🧭 Next Section: Guides

Explore practical guides on integrating APIs, routing, and testing in **[API Integration Guide](/guides/api-integration)**.
