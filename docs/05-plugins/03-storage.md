---
title: Storage & Persistence Plugin
description: Persisting reactive state seamlessly across page reloads using localStorage or sessionStorage.
order: 3
group: Plugins
---

# Storage Plugin (`euixjs/storage`)

The **Storage Plugin** adds automatic persistence to reactive state variables, syncing mutations to browser `localStorage` or `sessionStorage`.

---

## 💾 Declarative State Persistence (`persist="..."`)

Add the `persist` attribute to any `<state>` declaration:

```xml
<uid_spec>
  <data_model>
    <!-- Persisted across browser sessions in localStorage -->
    <state id="theme" persist="localStorage">dark</state>
    <state id="userSettings" type="object" persist="localStorage">
      {"sidebarOpen": true, "fontSize": 14}
    </state>

    <!-- Persisted only for the current tab session in sessionStorage -->
    <state id="auth_token" persist="sessionStorage"></state>
  </data_model>

  <flex direction="column" gap="8">
    <p>Active Theme: {data.theme}</p>
    
    <button class="btn">
      <on_click action="SET_STATE">
        <path>data.theme</path>
        <value>{data.theme === 'dark' ? 'light' : 'dark'}</value>
      </on_click>
      Toggle Theme
    </button>
  </flex>
</uid_spec>
```

When `data.theme` is mutated, the new value is automatically serialized and saved to `localStorage`. When the user refreshes the page, EUIX initializes the state with the saved value before initial render.

---

## 🧭 Next Step

Learn how to create accessible modal dialogs in **[Dialog Plugin](/plugins/dialog)**.
