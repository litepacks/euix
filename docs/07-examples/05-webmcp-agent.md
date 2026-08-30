---
title: WebMCP AI Agent Tooling Example
description: Exposing UI actions and state tools to browser AI agents using the WebMCP Plugin.
order: 5
group: Examples
---

# WebMCP AI Agent Tooling Example

This example demonstrates how to expose application actions to in-browser AI assistants (via `document.modelContext`) while sharing the exact same reactive state store with human UI users.

---

## ⚡ Complete Application Code

```xml
<uid_spec>
  <!-- 1. Shared Reactive State -->
  <data_model>
    <state id="cart" type="array">[]</state>
    <state id="total" type="number">0</state>
  </data_model>

  <!-- 2. WebMCP Declarative Tool Manifest for AI Agents -->
  <webmcp>
    <tool name="add_to_cart" description="Adds an item and price to the shopping cart">
      <param name="item_name" type="string" description="Name of the product" required="true" />
      <param name="price" type="number" description="Price in dollars" required="true" />
      
      <step action="MUTATE_STATE">
        <path>cart</path>
        <operation>PUSH</operation>
        <value>{"id": Date.now(), "name": "{args.item_name}", "price": {args.price}}</value>
      </step>
      <step action="SET_STATE">
        <path>data.total</path>
        <value>{data.total + args.price}</value>
      </step>
      
      <return>{"status": "success", "cart_size": {data.cart.length}}</return>
    </tool>

    <tool name="clear_cart" description="Empties the shopping cart">
      <step action="MUTATE_STATE"><path>cart</path><operation>CLEAR</operation></step>
      <step action="SET_STATE"><path>data.total</path><value>0</value></step>
      <return>{"status": "cleared"}</return>
    </tool>
  </webmcp>

  <!-- 3. Human UI Interface -->
  <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl border max-w-md mx-auto">
    <flex direction="row" justify="between" align="center">
      <h2 class="text-xl font-bold text-slate-800">Shopping Cart</h2>
      <span class="text-sm font-extrabold text-blue-600">Total: ${data.total}</span>
    </flex>

    <!-- Cart Items List -->
    <flex direction="column" gap="8">
      <if condition="{data.cart.length === 0}">
        <p class="text-sm text-slate-400 text-center py-4">Your cart is empty. Ask the AI agent or add items manually!</p>
      </if>

      <for_each items="{data.cart}" var="item">
        <flex direction="row" justify="between" align="center" class="p-2.5 bg-slate-50 rounded-lg border">
          <span class="text-sm font-medium">{item.name}</span>
          <span class="text-sm font-bold text-slate-600">${item.price}</span>
        </flex>
      </for_each>
    </flex>

    <!-- Manual Human Controls -->
    <flex direction="row" gap="8">
      <button class="btn flex-1">
        <on_click action="MUTATE_STATE">
          <path>cart</path>
          <operation>PUSH</operation>
          <value>{"id": Date.now(), "name": "Espresso Coffee", "price": 4}</value>
        </on_click>
        <on_click action="SET_STATE"><path>data.total</path><value>{data.total + 4}</value></on_click>
        + Add Coffee ($4)
      </button>
    </flex>
  </flex>
</uid_spec>
```

---

## 🧭 Next Section: Advanced Topics

Explore runtime architecture and fine-grained DOM mechanics in **[Runtime Architecture](/advanced/architecture)**.
