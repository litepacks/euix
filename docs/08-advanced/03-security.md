---
title: Security & Sandboxing
description: Security architecture, Content Security Policy (CSP), XSS defenses, and URI scheme guards in EUIX.
order: 3
group: Advanced
---

# Security & Sandboxing

Because EUIX parses markup and executes expressions dynamically, security considerations are foundational to the runtime design.

---

## 🛡️ Key Security Mechanisms

### 1. API URL Scheme Guarding
EUIX automatically inspects all endpoints and URLs before making network requests or binding dynamic links. Dangerous schemes—such as `javascript:`, `vbscript:`, and arbitrary `data:` URLs—are blocked automatically to prevent Cross-Site Scripting (XSS) attacks.

### 2. Isolated Script Scope (`RUN_SCRIPT`)
Inline scripts executed via `action="RUN_SCRIPT"` run inside an isolated `new Function(...)` scope rather than global `eval()`. Only explicit contextual references (`$data`, `$el`, `$evt`, `$engine`, `$item`, `$index`) are passed into the closure.

### 3. Safe Request Interceptors
Authentication headers and tokens should never be hardcoded into XML templates. Instead, use programmatic request interceptors:

```javascript
engine.api.onRequest((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});
```

---

## 🔒 Content Security Policy (CSP) Guidelines

If deploying EUIX in environments with strict Content Security Policies:
- **`script-src`**: Ensure `script-src` permits the origin serving the EUIX bundle.
- **AOT Pre-compilation (`euix compile`)**: In environments that disallow `'unsafe-eval'` entirely, pre-compile XML templates into pure JavaScript modules using the EUIX CLI before deployment.

---

## 🧭 Next Step

Check browser compatibility in **[Browser Support](/advanced/browser-support)**.
