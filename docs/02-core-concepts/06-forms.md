---
title: Forms & User Input
description: Two-way form data binding, select dropdowns, checkboxes, validation, and async form submissions in EUIX.
order: 6
group: Core Concepts
---

# Forms & User Input

EUIX provides native two-way binding (`bind="..."`) for form inputs, enabling clean, synchronized forms without repetitive `onChange` event handlers.

---

## 📝 Form Input Elements

### 1. Text Inputs & Textareas
```xml
<input bind="user.fullName" placeholder="Full Name" class="input" />
<input type="email" bind="user.email" placeholder="Email Address" class="input" />
<textarea bind="user.bio" placeholder="Write a short biography..." rows="4"></textarea>
```

### 2. Checkboxes (Boolean Binding)
```xml
<label class="flex items-center gap-2">
  <input type="checkbox" bind="user.isSubscribed" />
  <span>Subscribe to weekly newsletter</span>
</label>
```

### 3. Select Dropdowns
```xml
<select bind="user.plan" class="select">
  <option value="starter">Starter Plan ($9/mo)</option>
  <option value="pro">Professional Plan ($29/mo)</option>
  <option value="enterprise">Enterprise Plan ($99/mo)</option>
</select>
```

---

## 🚀 Complete Form Example with Validation & Submit

Here is a complete, realistic user profile form with client-side validation and declarative async submission:

```xml
<uid_spec>
  <!-- 1. State Definition -->
  <data_model>
    <state id="form_name">Alex Rivera</state>
    <state id="form_email">alex@example.com</state>
    <state id="form_role">developer</state>
    <state id="is_agree" type="boolean">false</state>
    <state id="is_submitting" type="boolean">false</state>
    <state id="success_msg"></state>
  </data_model>

  <!-- 2. Form Container -->
  <form class="p-6 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg">
    <!-- Declarative Submit Handler -->
    <on_submit action="RUN_SCRIPT">
      $evt.preventDefault();
      
      if (!$data.is_agree) {
        alert("Please accept the terms and conditions.");
        return;
      }

      $data.is_submitting = true;
      $data.success_msg = "";

      setTimeout(() => {
        $data.is_submitting = false;
        $data.success_msg = "Profile updated successfully!";
      }, 800);
    </on_submit>

    <h2 class="text-xl font-bold text-slate-800 mb-4">Edit Profile</h2>

    <!-- Success Feedback Banner -->
    <if condition="{data.success_msg.length > 0}">
      <div class="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-200">
        {data.success_msg}
      </div>
    </if>

    <flex direction="column" gap="14">
      <!-- Full Name -->
      <flex direction="column" gap="4">
        <label class="text-xs font-bold text-slate-600 uppercase">Full Name</label>
        <input bind="form_name" placeholder="Your name" class="px-3 py-2 border rounded-lg" />
      </flex>

      <!-- Email -->
      <flex direction="column" gap="4">
        <label class="text-xs font-bold text-slate-600 uppercase">Email Address</label>
        <input type="email" bind="form_email" placeholder="user@domain.com" class="px-3 py-2 border rounded-lg" />
      </flex>

      <!-- Role Selection -->
      <flex direction="column" gap="4">
        <label class="text-xs font-bold text-slate-600 uppercase">Primary Role</label>
        <select bind="form_role" class="px-3 py-2 border rounded-lg bg-white">
          <option value="developer">Developer</option>
          <option value="designer">Designer</option>
          <option value="manager">Product Manager</option>
        </select>
      </flex>

      <!-- Checkbox Agreement -->
      <label class="flex items-center gap-2 mt-2">
        <input type="checkbox" bind="is_agree" />
        <span class="text-sm text-slate-600">I agree to the privacy policy</span>
      </label>

      <!-- Submit Button with Dynamic Disabled State -->
      <button 
        type="submit" 
        disabled="{data.is_submitting}"
        class="mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors cursor-pointer"
      >
        {data.is_submitting ? 'Saving Profile...' : 'Save Changes'}
      </button>
    </flex>
  </form>
</uid_spec>
```

---

## 🧭 Next Section: Components

Learn how to build reusable, isolated widgets in **[Component Basics](/components/components)**.
