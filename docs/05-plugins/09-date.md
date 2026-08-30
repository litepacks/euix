---
title: Date & Intl Plugin
description: Localized date formatting, relative time calculation, and currency helpers using the EUIX Date Plugin.
order: 9
group: Plugins
---

# Date & Intl Plugin (`euixjs/date`)

The **Date Plugin** provides internationalization, date formatting, and relative time helpers (`$date`) backed by browser-native `Intl` APIs and lightweight formatting engines.

---

## 📅 Formatting Dates in Templates

```xml
<uid_spec>
  <data_model>
    <state id="createdAt">2026-08-30T12:00:00Z</state>
  </data_model>

  <flex direction="column" gap="8" class="p-6">
    <p>Raw ISO: {data.createdAt}</p>
    
    <!-- Using $date helper inside expressions or RUN_SCRIPT -->
    <button class="btn">
      <on_click action="RUN_SCRIPT">
        console.log("Formatted:", $date.format($data.createdAt, "YYYY-MM-DD"));
        console.log("Relative:", $date.fromNow($data.createdAt));
      </on_click>
      Inspect Formats
    </button>
  </flex>
</uid_spec>
```

---

## 🧭 Next Step

Learn how to expose application actions to browser AI agents in **[WebMCP Plugin](/plugins/webmcp)**.
