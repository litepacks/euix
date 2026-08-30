---
title: Accessibility Best Practices
description: Accessible markup, ARIA attributes, keyboard navigation, focus management, and reduced-motion support in EUIX.
order: 4
group: Guides
---

# Accessibility Best Practices

Building inclusive web applications requires accessible primitives paired with semantic markup. EUIX is designed to preserve native browser accessibility behaviors with zero interference.

---

## ♿ Core Accessibility Principles in EUIX

1. **Native HTML Semantics**: EUIX parses and renders standard HTML5 elements (`<button>`, `<main>`, `<nav>`, `<dialog>`, `<form>`, `<label>`). Native elements provide built-in keyboard navigation, accessibility tree roles, and screen reader announcements out of the box.
2. **Transparent ARIA Passthrough**: Any `aria-*` or `role` attribute is rendered directly onto the output DOM elements without stripping or mangling:
   ```xml
   <button aria-expanded="{data.isMenuOpen}" aria-controls="mobile-nav" class="btn">
     Menu
   </button>
   ```
3. **Automatic Focus Trapping in Modals**: The `<dialog>` plugin automatically traps focus within active modal dialogs and handles the `Escape` key dismiss sequence.
4. **Reduced Motion Support**: The EUIX Animation Plugin automatically obeys OS-level `prefers-reduced-motion` settings.

> [!IMPORTANT]
> **Developer Responsibility Note**:
> While EUIX provides accessible container primitives and passes through all ARIA attributes, **application authors remain responsible for valid semantic structuring, contrast ratios, and descriptive labels**. Using EUIX does not automatically make an inaccessible design WCAG-compliant.

---

## 🧭 Next Step

Explore debugging and inspecting state in **[Debugging & DevTools](/guides/debugging)**.
