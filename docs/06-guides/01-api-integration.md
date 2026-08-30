---
title: REST API Integration & SWR
description: Practical patterns for GET/POST requests, pagination, optimistic updates, and offline fallback.
order: 1
group: Guides
---

# REST API Integration & SWR

This guide details best practices for connecting EUIX applications to backend REST APIs using the SWR client and declarative HTTP actions.

---

## 🔄 GET Endpoints with SWR Caching

```xml
<uid_spec>
  <data_model>
    <state id="users" type="array">[]</state>
  </data_model>

  <api_config base_url="https://jsonplaceholder.typicode.com">
    <api_endpoint 
      id="fetch_users" 
      url="/users" 
      method="GET" 
      bind_target="users" 
      auto_fetch="true" 
      revalidate_focus="true" 
      persist="localStorage" 
    />
  </api_config>

  <flex direction="column" gap="12" class="p-6">
    <button class="btn">
      <on_click action="REVALIDATE_API" tag="fetch_users" />
      Revalidate Users
    </button>

    <if condition="{api.fetch_users.loading}">
      <p class="text-slate-400">Loading user directory...</p>
    </if>

    <for_each items="{data.users}" var="u">
      <div class="p-3 bg-white shadow rounded border">
        <strong>{u.name}</strong> ({u.email})
      </div>
    </for_each>
  </flex>
</uid_spec>
```

---

## 📤 POST Requests & State Mutation

```xml
<uid_spec>
  <data_model>
    <state id="newTitle"></state>
    <state id="isSubmitting" type="boolean">false</state>
  </data_model>

  <flex direction="column" gap="8" class="p-6">
    <input bind="newTitle" placeholder="Enter title" class="input" />
    
    <button class="btn" disabled="{data.isSubmitting}">
      <on_click action="SET_STATE"><path>data.isSubmitting</path><value>true</value></on_click>
      <on_click action="XHR">
        <method>POST</method>
        <url>https://jsonplaceholder.typicode.com/posts</url>
        <body>{"title": "{data.newTitle}", "userId": 1}</body>
      </on_click>
      <on_click action="SET_STATE"><path>data.newTitle</path><value></value></on_click>
      <on_click action="SET_STATE"><path>data.isSubmitting</path><value>false</value></on_click>
      Publish Post
    </button>
  </flex>
</uid_spec>
```

---

## 🧭 Next Step

Learn how to integrate existing JavaScript libraries in **[Integrating JavaScript Libraries](/guides/third-party-libraries)**.
