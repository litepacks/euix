---
title: Browser Support & Requirements
description: Supported browsers, minimum version matrix, and required modern web platform APIs for EUIX Engine.
order: 4
group: Advanced
---

# Browser Support & Requirements

EUIX Engine targets modern web standards and works seamlessly across all evergreen web browsers.

---

## 🌐 Supported Browsers

| Browser | Minimum Version | Status |
| :--- | :--- | :--- |
| **Google Chrome / Chromium** | Version 88+ | Fully Supported |
| **Mozilla Firefox** | Version 85+ | Fully Supported |
| **Apple Safari / iOS WebKit**| Version 14.1+ | Fully Supported |
| **Microsoft Edge** | Version 88+ | Fully Supported |
| **Node.js (JSDOM / SSR)** | Version 18.x, 20.x, 22.x, 24.x | Fully Supported |

---

## ⚡ Required Web Platform APIs

EUIX relies on standard browser features available across all modern environments:
- **`Proxy` & `Reflect`**: For fine-grained reactive state tracking.
- **`queueMicrotask`**: For batching synchronous state mutations.
- **`DOMParser`**: For initial XML specification parsing.
- **`IntersectionObserver`**: For `<on_visible>` lazy viewport intersection triggers.
- **`Intl` APIs**: For localized date and number formatting.

---

## 🧭 Next Step

Explore conceptual mappings in **[Coming from React or Vue](/advanced/coming-from-react-vue)**.
