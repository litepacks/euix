---
name: robust-code-craft
description: >-
  Guidelines, defensive programming techniques, and invariant verification procedures for generating
  rock-solid, production-grade code with LLMs. Use when designing, writing, refactoring, or reviewing
  core logic, API surfaces, state management, or complex algorithmic routines.
---

# Robust Code Craft: Engineering Bulletproof Systems with LLMs

This skill defines practical rules, patterns, and validation checklists to ensure that code written or refactored by LLMs is robust, maintainable, regression-free, and production-ready.

---

## 🛡️ 1. Core Principles of Robust Code

### 1.1 Invariant Protection & Fail-Fast Boundaries
* **Validate at the Perimeter**: Check types, shapes, and preconditions at public API entry points, user input handlers, and network boundaries.
* **Never Assume Object Shape**:
  ```ts
  // ❌ Fragile: Unchecked nested access
  const username = response.data.user.profile.name;

  // ✅ Robust: Optional chaining with clear fallback or early invariant assertion
  const username = response?.data?.user?.profile?.name ?? "Anonymous";
  ```
* **Guard Against Common Boundary Cases**:
  - `null`, `undefined`, `NaN`, `""` (empty string), `0`, `-0`, `false`.
  - Empty arrays `[]`, sparse arrays, non-iterable objects passed to iterators.
  - Number overflow, negative indices, floating point inaccuracies (`0.1 + 0.2`).

### 1.2 Side-Effect Isolation & Pure Domain Logic
* **Separate Computation from Mutation**: Keep business logic, math, formatting, and data transformation in pure, deterministic functions that take inputs and return outputs without mutating arguments.
* **Idempotency**: Whenever possible, ensure operations (such as initializers, sync routines, teardowns) can be executed multiple times safely without corrupted state or duplicate side effects.

### 1.3 Asynchronous Safety & Race Condition Protection
* **Stale Response / Out-of-Order Guards**:
  In UI or client-side code, async responses must never write to state if a newer request was dispatched or if the component was unmounted:
  ```ts
  let activeRequestId = 0;

  async function fetchData(query: string) {
    const currentId = ++activeRequestId;
    setLoading(true);
    try {
      const data = await api.search(query);
      if (currentId !== activeRequestId) return; // Discard stale response
      setData(data);
    } catch (err) {
      if (currentId !== activeRequestId) return;
      setError(err);
    } finally {
      if (currentId === activeRequestId) setLoading(false);
    }
  }
  ```
* **Reentrancy Locks**: Use explicit boolean or token guards (`_isProcessing`, `_isRevalidating`) to prevent duplicate simultaneous execution of critical async tasks.
* **AbortController Propagation**: Always accept and forward `AbortSignal` to async operations (fetch, worker tasks, timers).

---

## 🔍 2. Error Handling & Resilience Patterns

### 2.1 Never Swallow Errors Silently
```ts
// ❌ Dangerous: Completely hides bugs and causes mysterious silent failures
try {
  doRiskyOperation();
} catch (e) {}

// ✅ Robust: Differentiate expected domain errors from unexpected bugs, report cleanly
try {
  doRiskyOperation();
} catch (err) {
  logger.warn('Failed to perform operation, applying fallback', { error: err });
  applySafeFallback();
}
```

### 2.2 Rich, Typed Domain Errors
* Use structured error classes with distinct names and metadata:
  ```ts
  export class ValidationError extends Error {
    constructor(message: string, public readonly field: string, public readonly code: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  ```

### 2.3 Resilient Fallbacks
* If a secondary feature fails (e.g. telemetry, analytics, cache persistence), it must **never** crash the primary user workflow.
* Always wrap optional non-critical features in isolated `try/catch` boundaries.

---

## 🧹 3. Resource Management & Memory Safety

* **Paired Allocations**: Every resource allocation must have an explicit, symmetrical deallocation:
  | Resource | Setup | Teardown |
  | :--- | :--- | :--- |
  | DOM / Window Listener | `addEventListener(type, fn)` | `removeEventListener(type, fn)` with exact function reference |
  | Timer | `setInterval` / `setTimeout` | `clearInterval` / `clearTimeout` |
  | Observer | `new ResizeObserver(cb).observe(el)` | `observer.disconnect()` |
  | WebSocket / Stream | `new WebSocket(url)` | `ws.close()` |
  | AbortController | `new AbortController()` | `controller.abort()` |

* **Function Reference Retention**:
  Never use inline anonymous arrow functions for event listeners that need removal:
  ```ts
  // ❌ Cannot be removed later!
  window.addEventListener('resize', () => this.onResize());

  // ✅ Store bound reference on instance
  this._boundResize = this.onResize.bind(this);
  window.addEventListener('resize', this._boundResize);
  // In destroy():
  window.removeEventListener('resize', this._boundResize);
  ```

---

## 🎯 4. Diff Discipline for LLMs

When modifying existing codebases:
1. **Preserve Surrounding Context**: Do not strip existing docstrings, TypeScript annotations, edge-case comments, or auxiliary checks.
2. **Minimal Blast Radius**: Solve the exact problem without unnecessary refactoring of adjacent stable code.
3. **Adhere to Codebase Idioms**: Follow the existing style, naming conventions, and file structures rather than introducing new paradigms unprompted.
4. **Static Verification**: Run project linters, typecheckers, and static validators before declaring completion.
