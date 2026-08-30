---
title: Form Validation Example
description: Synchronous and asynchronous form validation with error state management in EUIX.
order: 3
group: Examples
---

# Form Validation Example

This example demonstrates how to build an interactive Login / Registration form with **validation error tracking** and **asynchronous submission states**.

---

## ⚡ Complete Application Code

```xml
<uid_spec>
  <data_model>
    <state id="email"></state>
    <state id="password"></state>
    <state id="errorMessage"></state>
    <state id="isLoading" type="boolean">false</state>
    <state id="isSuccess" type="boolean">false</state>
  </data_model>

  <flex direction="column" gap="16" class="p-8 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm mx-auto">
    <h2 class="text-2xl font-bold text-slate-800 text-center">Account Sign In</h2>

    <!-- Error Banner -->
    <if condition="{data.errorMessage.length > 0}">
      <div class="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200">
        {data.errorMessage}
      </div>
    </if>

    <!-- Success Banner -->
    <if condition="{data.isSuccess}">
      <div class="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
        Authentication successful! Redirecting...
      </div>
    </if>

    <form class="flex flex-col gap-4">
      <on_submit action="RUN_SCRIPT">
        $evt.preventDefault();
        $data.errorMessage = "";

        if (!$data.email || !$data.email.includes("@")) {
          $data.errorMessage = "Please enter a valid email address.";
          return;
        }

        if (!$data.password || $data.password.length < 6) {
          $data.errorMessage = "Password must be at least 6 characters.";
          return;
        }

        $data.isLoading = true;
        setTimeout(() => {
          $data.isLoading = false;
          $data.isSuccess = true;
        }, 1000);
      </on_submit>

      <!-- Email Field -->
      <flex direction="column" gap="4">
        <label class="text-xs font-bold text-slate-600">Email Address</label>
        <input type="email" bind="email" placeholder="user@company.com" class="px-3 py-2 border rounded-xl" />
      </flex>

      <!-- Password Field -->
      <flex direction="column" gap="4">
        <label class="text-xs font-bold text-slate-600">Password</label>
        <input type="password" bind="password" placeholder="••••••••" class="px-3 py-2 border rounded-xl" />
      </flex>

      <!-- Submit Button -->
      <button 
        type="submit" 
        disabled="{data.isLoading}"
        class="mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors cursor-pointer"
      >
        {data.isLoading ? 'Verifying...' : 'Sign In'}
      </button>
    </form>
  </flex>
</uid_spec>
```

---

## 🧭 Next Example

See how to integrate GIS maps in **[Leaflet Interactive Map Example](/examples/leaflet-map)**.
