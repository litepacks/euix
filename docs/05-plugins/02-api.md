---
title: SWR REST API Plugin
description: Declarative HTTP fetching, Stale-While-Revalidate caching, offline queuing, and reactive request status.
order: 2
group: Plugins
---

# SWR REST API Plugin (`euixjs/api`)

The **API Plugin** brings declarative HTTP endpoints, automatic Stale-While-Revalidate (SWR) caching, and reactive request status binding to EUIX.

---

## 📡 Declarative Endpoint Configuration (`<api_config>`)

Configure your endpoints at the top of your XML specification:

```xml
<uid_spec>
  <data_model>
    <state id="posts" type="array">[]</state>
  </data_model>

  <!-- 1. API Configuration -->
  <api_config base_url="https://jsonplaceholder.typicode.com">
    <!-- Auto-fetching GET endpoint with SWR caching -->
    <api_endpoint 
      id="get_posts" 
      url="/posts?_limit=5" 
      method="GET" 
      bind_target="posts" 
      auto_fetch="true" 
      revalidate_focus="true" 
    />

    <!-- On-demand POST endpoint -->
    <api_endpoint 
      id="create_post" 
      url="/posts" 
      method="POST" 
      auto_fetch="false" 
    />
  </api_config>

  <!-- 2. UI Binding & Reactive Status -->
  <flex direction="column" gap="12" class="p-6">
    <flex direction="row" justify="between" align="center">
      <h2>Posts</h2>
      <button class="btn">
        <on_click action="REVALIDATE_API" tag="get_posts" />
        Refresh
      </button>
    </flex>

    <!-- Reactive Loading Indicator -->
    <if condition="{api.get_posts.loading}">
      <p class="text-blue-500 font-semibold">Loading posts...</p>
    </if>

    <!-- Reactive Error Banner -->
    <if condition="{api.get_posts.error}">
      <p class="text-rose-500 font-semibold">Error: {api.get_posts.error}</p>
    </if>

    <!-- Data List -->
    <for_each items="{data.posts}" var="post">
      <div class="p-3 bg-slate-50 border rounded-lg">
        <h4 class="font-bold">{post.title}</h4>
        <p class="text-sm text-slate-600">{post.body}</p>
      </div>
    </for_each>
  </flex>
</uid_spec>
```

---

## 🏷️ Endpoint Attributes Reference

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | *required* | Unique identifier for the endpoint. |
| `url` | `string` | *required* | Request URL path (prefixed with `base_url` unless starting with `./`). |
| `method` | `string` | `GET` | HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`). |
| `bind_target` | `string` | `null` | Target state path to store successful response data. |
| `auto_fetch` | `boolean` | `true` | When `true`, automatically fetches data upon mount. |
| `revalidate_focus`| `boolean` | `false` | When `true`, revalidates data when the browser window gains focus. |
| `persist` | `string` | `none` | Cache storage target (`localStorage` or `sessionStorage`). |
| `queue_offline` | `boolean` | `false` | When `true`, queues mutation requests when offline and sends them when online. |

---

## ⚡ Automatic Reactive Status (`{api.<id>.<property>}`)

You can access endpoint execution status anywhere in your templates:
- `{api.<id>.loading}`: `true` while the request is in flight.
- `{api.<id>.error}`: Error message string if the request failed; otherwise `null`.
- `{api.<id>.status}`: HTTP status code integer (e.g. `200`, `404`, `500`).
- `{api.<id>.data}`: The raw response data payload.
- `{api.<id>.timestamp}`: Unix timestamp when the request last completed.

---

## 💻 Programmatic Control

```javascript
// Manually trigger revalidation
engine.revalidateApi('get_posts');

// Check current status
const status = engine.getApiStatus('get_posts');
console.log('Loading:', status.loading);

// Clear cache
engine.clearApiCache('get_posts');
```

---

## 🧭 Next Step

Learn how to persist state across browser sessions in **[Storage Plugin](/plugins/storage)**.
