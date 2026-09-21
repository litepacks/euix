---
name: memory-and-performance-hygiene
description: >-
  Guidelines, memory leak prevention patterns, zero-allocation techniques, and performance hygiene for
  writing high-throughput, low-latency, leak-free code with LLMs. Use when profiling, optimizing algorithms,
  handling large collections, DOM manipulations, or long-running worker/service lifecycles.
---

# Memory & Performance Hygiene: Zero-Leak, High-Throughput Engineering

This skill provides practical rules, memory leak prevention patterns, and hot-path optimization techniques for generating high-performance, leak-free software with LLMs.

---

## 🧠 1. Memory Leak Prevention & Lifecycle Hygiene

In long-running browser sessions, node processes, and reactive UI engines, memory leaks degrade performance over time and cause crashes.

### 1.1 The Top 4 Memory Leak Vectors
| Vector | Common Mistake | Robust Solution |
| :--- | :--- | :--- |
| **Detached DOM Nodes** | Storing references to DOM elements in long-lived caches/arrays after removal from document. | Clear element references when unmounting, or use `WeakMap<Element, Metadata>` so entries are garbage collected automatically. |
| **Unbounded Caches** | Using `new Map()` or plain objects as caches without eviction or maximum capacity. | Implement an LRU cache or set an explicit hard limit (`if (cache.size > MAX) cache.delete(oldestKey)`). |
| **Dangling Listeners** | Registering `window`, `document`, or global emitter listeners without symmetric removal. | Keep bound function references and execute teardown in `destroy()`, or pass an `AbortSignal` (`{ signal }`). |
| **Unstopped Observers & Timers** | `ResizeObserver`, `MutationObserver`, or `setInterval` running after component unmount. | Symmetrically invoke `observer.disconnect()` and `clearInterval(timerId)`. |

### 1.2 Using `WeakMap` and `WeakSet` for Metadata
When associating auxiliary data with objects or DOM elements, prefer `WeakMap`:
```ts
// ❌ Retains entire DOM element in memory forever even after removeChild()
const metadataCache = new Map<HTMLElement, ItemData>();

// ✅ Automatically garbage collected when element is discarded from DOM
const metadataCache = new WeakMap<HTMLElement, ItemData>();
```

### 1.3 Event Teardown via `AbortSignal`
Modern browsers and Node.js support `signal` in event listeners for effortless mass-cleanup:
```ts
class Component {
  private abortController = new AbortController();

  mount() {
    const { signal } = this.abortController;
    window.addEventListener('resize', this.onResize, { signal });
    window.addEventListener('scroll', this.onScroll, { signal });
    document.addEventListener('keydown', this.onKeyDown, { signal });
  }

  destroy() {
    // Automatically removes all listeners attached with this signal in one call!
    this.abortController.abort();
  }
}
```

---

## ⚡ 2. Zero-Allocation & Hot-Path Optimization

Garbage Collection (GC) pauses are the primary cause of UI frame drops and backend latency spikes. Minimize heap allocation in hot execution loops.

### 2.1 Avoid Chained Intermediate Arrays in Hot Loops
```ts
// ❌ Allocates 3 intermediate arrays on every invocation
const activeHighPriorityIds = items
  .filter(item => item.isActive)
  .filter(item => item.priority > 5)
  .map(item => item.id);

// ✅ Single-pass loop with zero intermediate array allocations
const activeHighPriorityIds: string[] = [];
for (let i = 0, len = items.length; i < len; i++) {
  const item = items[i];
  if (item.isActive && item.priority > 5) {
    activeHighPriorityIds.push(item.id);
  }
}
```

### 2.2 Lookup Complexity: O(1) Sets vs O(N) Arrays
Never use `Array.includes()` or `Array.indexOf()` inside a loop:
```ts
// ❌ O(N * M) quadratic complexity
const filtered = items.filter(item => allowedIds.includes(item.id));

// ✅ O(N + M) linear complexity with O(1) Set lookup
const allowedSet = new Set(allowedIds);
const filtered = items.filter(item => allowedSet.has(item.id));
```

### 2.3 Object Pooling & Scratch Buffers
In routines executed hundreds of times per second (e.g. animation frames, physics, tokenizers, expression parsers):
- Reuse pre-allocated scratch objects, arrays, or TypedArrays (`Uint8Array`, `Float64Array`) rather than re-instantiating inside the loop.
- Clear and reuse array lengths (`arr.length = 0`) instead of allocating `arr = []`.

---

## 🖥️ 3. DOM & Layout Performance

### 3.1 Eliminate Layout Thrashing (Forced Synchronous Layout)
Layout thrashing occurs when JavaScript repeatedly interleaves reading geometry properties with writing styles:
```ts
// ❌ Bad: Forces the browser to recalculate layout on every iteration!
elements.forEach(el => {
  const width = el.offsetWidth; // READ (Forces layout)
  el.style.width = (width + 10) + 'px'; // WRITE (Invalidates layout)
});

// ✅ Good: Batch all reads first, then batch all writes
const widths = elements.map(el => el.offsetWidth); // Batch READS
elements.forEach((el, i) => {
  el.style.width = (widths[i] + 10) + 'px'; // Batch WRITES
});
```

### 3.2 Batch DOM Insertions with `DocumentFragment`
```ts
// ❌ Causes N individual DOM reflows
items.forEach(item => container.appendChild(renderItem(item)));

// ✅ Batches all items into 1 reflow
const fragment = document.createDocumentFragment();
items.forEach(item => fragment.appendChild(renderItem(item)));
container.appendChild(fragment);
```

---

## 📊 4. Performance Validation Protocol

1. **Benchmark Before Optimizing**: Establish a verifiable baseline before changing any code. Never optimize based on assumptions.
2. **Isolate JIT Warmup**: Run test loops 1,000 times before measuring to allow the JIT compiler to optimize.
3. **Verify Memory Profile**: Run test routines 10,000+ times and observe heap memory (`process.memoryUsage().heapUsed` or Chrome DevTools Memory Heap Snapshot) to ensure memory returns to baseline without steady linear growth.
