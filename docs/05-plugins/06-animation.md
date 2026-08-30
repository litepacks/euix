---
title: Animation & Transitions Plugin
description: Declarative CSS keyframe animations, enter/leave transitions, and prefers-reduced-motion accessibility compliance.
order: 6
group: Plugins
---

# Animation Plugin (`euixjs/animation`)

The **Animation Plugin** enables declarative keyframe transitions, fade effects, and enter/leave lifecycle animations.

---

## 🎬 Declarative Animations (`<animate>`)

```xml
<uid_spec>
  <data_model>
    <state id="showBanner" type="boolean">true</state>
  </data_model>

  <if condition="{data.showBanner}">
    <animate name="fade-in-up" duration="350ms">
      <div class="p-4 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-between">
        <span>Welcome to EUIX Engine!</span>
        <button>
          <on_click action="SET_STATE">
            <path>data.showBanner</path>
            <value>false</value>
          </on_click>
          ✕
        </button>
      </div>
    </animate>
  </if>
</uid_spec>
```

---

## ♿ Accessibility: `prefers-reduced-motion`

The EUIX Animation Plugin automatically respects the user's operating system animation settings:

- When the browser or OS has **Reduced Motion** enabled (`prefers-reduced-motion: reduce`), animations automatically reduce to instantaneous zero-duration transitions.
- This ensures full compliance with accessibility standards (WCAG 2.2 Success Criterion 2.3.3) without requiring application authors to write manual media query overrides.

---

## 🧭 Next Step

Learn about charting in **[Chart.js Plugin](/plugins/chart)**.
