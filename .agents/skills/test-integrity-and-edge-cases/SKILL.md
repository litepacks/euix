---
name: test-integrity-and-edge-cases
description: >-
  Guidelines, edge-case discovery matrices, and testing integrity protocols for generating deterministic,
  high-coverage, non-flaky test suites with LLMs. Use when writing unit, integration, or regression tests,
  asserting edge cases, or validating bug fixes.
---

# Test Integrity & Edge Cases: Bulletproof Testing with LLMs

This skill provides a systematic framework for generating comprehensive, deterministic, and non-flaky test suites. When LLMs write tests, they often test only the "happy path" or write tautological assertions. This guide ensures tests catch real regressions and enforce system invariants.

---

## 🔬 1. The Systematic Edge-Case Matrix

Before writing or reviewing any implementation, systematically evaluate input and environment boundaries across these categories:

### 1.1 Primitives & Numbers
| Category | Values to Test | Why It Breaks |
| :--- | :--- | :--- |
| **Zero & Negatives** | `0`, `-0`, `-1`, `Number.MIN_SAFE_INTEGER` | Division by zero, off-by-one errors, negative array indexing. |
| **Extremes & Limits** | `Number.MAX_SAFE_INTEGER`, `Infinity`, `-Infinity` | Integer overflow, precision loss in calculations. |
| **Not-a-Number** | `NaN` | `NaN !== NaN`, fails equality assertions silently. |
| **Float Precision** | `0.1 + 0.2`, `1e-7` | Rounding errors breaking strict equality checks (`toBeCloseTo`). |

### 1.2 Strings & Text
| Category | Values to Test | Why It Breaks |
| :--- | :--- | :--- |
| **Empty & Whitespace** | `""`, `"   "`, `"\t\n\r"` | Trimming bugs, falsy check confusion (`""` is falsy). |
| **Unicode & Emoji** | `"🚀"`, `"café"`, multi-byte astral symbols | `.length` returns code units (2 for emoji), string slicing splits surrogate pairs. |
| **Special Characters** | `<`, `>`, `&`, `"`, `'`, `/`, `\`, `\0` (null byte) | XSS, unescaped XML/HTML, regex metacharacter injection. |
| **Format Variations** | Trailing/leading slashes, lowercase/uppercase mismatches | URL routing, case-sensitive dictionary lookups. |

### 1.3 Collections (Arrays, Objects, Sets, Maps)
| Category | Values to Test | Why It Breaks |
| :--- | :--- | :--- |
| **Empty Collection** | `[]`, `{}`, `new Set()`, `new Map()` | `arr[0]` is undefined, `.reduce()` on empty array throws without initial value. |
| **Single Item** | `[item]` | Algorithms that assume at least two items (sorting, diffing, pairing). |
| **Duplicates** | `[1, 1, 1]`, `{ a: 1, a: 2 }` | Key collision, deduplication logic failures, unstable sorting. |
| **Sparse Arrays** | `new Array(3)`, `[1, , 3]` | `forEach`/`map` skip empty slots, `for...of` yields `undefined`. |
| **Nested & Circular** | Deeply nested objects, `obj.self = obj` | Maximum call stack exceeded in recursive cloners/serializers. |

### 1.4 Asynchronous & Concurrency Edge Cases
- **Immediate Resolution vs Rejection**: Tests must verify behavior when promises reject immediately or resolve synchronously.
- **Out-of-Order Delivery**: Fast responses returning after slow responses (network jitter).
- **Aborted Signals**: Verify cleanup when `AbortSignal.abort()` is triggered before, during, or after operation execution.

---

## 🎯 2. Deterministic Testing & Flake Elimination

### 2.1 Never Use Arbitrary `setTimeout` / Sleep
```ts
// ❌ Flaky: arbitrary sleep time might fail on slow CI runners
await new Promise(r => setTimeout(r, 50));
expect(result.ready).toBe(true);

// ✅ Deterministic: Polling with timeout or event-driven promise
await vi.waitFor(() => {
  expect(result.ready).toBe(true);
}, { timeout: 1000, interval: 10 });
```

### 2.2 Fake Timers Hygiene
When using fake timers (`vi.useFakeTimers()`), always restore them cleanly:
```ts
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
```

### 2.3 Mock Isolation & Restoration
Never leave mock pollution across test runs:
```ts
afterEach(() => {
  vi.restoreAllMocks(); // Restores original implementations and clears calls
});
```

---

## 🛡️ 3. High-Signal Assertions

### 3.1 Avoid Trivial / Weak Assertions
```ts
// ❌ Weak: Passes even if output is an empty object or broken shape
expect(response).toBeDefined();
expect(response).toBeTruthy();

// ✅ Strong: Asserts precise shape and invariants
expect(response).toEqual({
  id: expect.any(String),
  status: 'active',
  count: 42,
  items: expect.arrayContaining([expect.objectContaining({ id: 'item-1' })])
});
```

### 3.2 Specific Error Assertions
```ts
// ❌ Weak: Passes for any thrown error (e.g. TypeError from a null pointer)
await expect(action()).rejects.toThrow();

// ✅ Strong: Asserts exact error type, error message, or error code
await expect(action()).rejects.toThrowError(ValidationError);
await expect(action()).rejects.toMatchObject({
  code: 'INVALID_CREDENTIALS',
  status: 401
});
```

---

## 🔄 4. Bug Fix & Regression Testing Protocol

When fixing a reported bug or edge case, follow this strict four-step protocol:

1. **Reproduce First (Red)**: Write a failing test that accurately models the exact bug scenario reported by the user or discovered in production. Confirm it fails for the expected reason.
2. **Isolate the Fix (Green)**: Apply the minimal, targeted code fix without breaking unrelated behaviors. Confirm the test passes.
3. **Verify Boundary Conditions**: Add complementary tests for adjacent inputs (e.g., if fixing zero handling, also test negative numbers and `NaN`).
4. **Name Semantically**: Name the test with clear context:
   ```ts
   it('should handle zero gracefully when calculating discount rate (Issue #142)', () => {
     expect(calculateDiscount(100, 0)).toBe(100);
   });
   ```

---

## 🏝️ 5. Declarative UI & Island Architecture Testing Protocols

When testing declarative reactive UI engines (such as EUIX) and island-based DOM architectures:

### 5.1 Strict Mode Locator Disambiguation
When multiple islands or components exist on the same page, tests must never use overly broad selectors that trigger Playwright strict-mode violations:
```js
// ❌ Flaky / Fails with strict-mode violation when multiple islands render <h3>
await expect(page.locator('div[data-euix="/counter.xml"] h3')).toHaveText('Counter');

// ✅ Robust: Scope to a specific instance or container
const firstIsland = page.locator('div[data-euix="/counter.xml"]').first();
await expect(firstIsland.locator('h3').first()).toHaveText('Live Counter #1');
```

### 5.2 Cross-Platform Keyboard Shortcuts
Mac keyboards mutate `event.key` when Alt/Option is pressed (e.g. `Alt+Shift+X` outputs `˛` on macOS or `≈` on Turkish Q).
- **Rule**: Always assert against physical hardware code (`e.code === 'KeyX'`) rather than layout-dependent character values (`e.key === 'x'`).

### 5.3 Static Validation Before Browser Execution
Always run static semantic validation before spending execution budget on heavy browser tests:
```bash
# 1. Static validation (zero-DOM, instant)
npx euix doctor apps/playground

# 2. End-to-End browser verification
npx playwright test apps/playground/e2e/declarative_automount.spec.js
```

