/**
 * packages/core/tests/microtask_starvation_guard.test.js
 * Test suite for Item 4: Microtask Queue Starvation & Batch Recursion Limiters
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXStructuredError } from "../src/core/parser/errors.js";

describe("Item 4: Microtask Queue Starvation & Batch Recursion Limiters", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    // -------------------------------------------------------------------------
    // 1. Recursive Microtask Loop Detection (Microtask Queue Starvation Guard)
    // -------------------------------------------------------------------------
    describe("1. Recursive Microtask Starvation Guard", () => {
        it("should catch recursive microtask cascade and abort microtask queue starvation", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="step_a" type="number">0</state>
                        <state id="step_b" type="number">0</state>
                    </data_model>
                    <div>
                        <span id="display">{data.step_a} - {data.step_b}</span>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const errorsReported = [];
            engine.onError = (err) => errorsReported.push(err);

            // Set a tight microtask depth for rapid test determinism
            engine._maxMicrotaskDepth = 6;

            // Ping-pong recursive microtask chain:
            // Each microtask schedules the next microtask without yielding to macrotask
            engine.watch("step_a", (val) => {
                queueMicrotask(() => {
                    engine.setState("step_b", val + 1, { batch: true });
                });
            });

            engine.watch("step_b", (val) => {
                queueMicrotask(() => {
                    engine.setState("step_a", val + 1, { batch: true });
                });
            });

            // Kick off the infinite batch microtask loop
            engine.setState("step_a", 1, { batch: true });

            // Wait for microtask cascade to trigger starvation guard
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Verify starvation guard caught the loop
            expect(errorsReported.length).toBeGreaterThan(0);
            const starvationErr = errorsReported.find(
                (e) => e.code === "MICROTASK_CASCADE_LIMIT_EXCEEDED" || (e.message && e.message.includes("Microtask Starvation Guard"))
            );
            expect(starvationErr).toBeDefined();
            expect(starvationErr.message).toContain("Microtask Starvation Guard");

            // Verify engine safely flushed and recovered without hanging the event loop
            expect(engine._pendingBatchChanges.size).toBe(0);
            expect(engine._microtaskScheduled).toBe(false);
            expect(engine._microtaskRecursionCount).toBe(0);
        });

        it("should catch synchronous batch loops inside flushStateUpdates via Batch Flush Guard", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="ping" type="number">0</state>
                        <state id="pong" type="number">0</state>
                    </data_model>
                    <div>{data.ping} - {data.pong}</div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const errorsReported = [];
            engine.onError = (err) => errorsReported.push(err);
            engine._maxFlushLoops = 5;

            engine.watch("ping", (val) => {
                engine.setState("pong", val + 1, { batch: true });
            });

            engine.watch("pong", (val) => {
                engine.setState("ping", val + 1, { batch: true });
            });

            engine.setState("ping", 1, { batch: true });
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(errorsReported.length).toBeGreaterThan(0);
            const batchErr = errorsReported.find((e) => e.code === "BATCH_FLUSH_CYCLE_ERROR");
            expect(batchErr).toBeDefined();
            expect(batchErr.message).toContain("Batch Flush Guard");
        });

        it("should reset microtask recursion counter once benign batch queue completely drains", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="count" type="number">0</state>
                    </data_model>
                    <div>Count: {data.count}</div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // Execute isolated batched updates
            engine.setState("count", 1, { batch: true });
            engine.setState("count", 2, { batch: true });
            engine.setState("count", 3, { batch: true });

            // Wait for microtask to execute and macrotask to reset counter
            await new Promise((r) => setTimeout(r, 10));

            // State is updated
            expect(engine.getState("count")).toBe(3);
            // Counter reset to 0 once event loop turns to macrotask
            expect(engine._microtaskRecursionCount).toBe(0);
            expect(engine._microtaskScheduled).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // 2. Synchronous Inner Batch Flush Loop Guard (BATCH_FLUSH_CYCLE_ERROR)
    // -------------------------------------------------------------------------
    describe("2. Inner Batch Flush Loop Guard", () => {
        it("should detect and terminate circular synchronous batch mutations during flushStateUpdates", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="val" type="number">0</state>
                    </data_model>
                    <div>{data.val}</div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const errorsReported = [];
            engine.onError = (err) => errorsReported.push(err);
            engine._maxFlushLoops = 5;

            // Watcher continuously adds new batch changes synchronously with changing values
            engine.watch("val", (currentVal) => {
                engine.setState("val", (currentVal || 0) + 1, { batch: true });
            });

            // Trigger flush synchronously
            engine.setState("val", 1, { batch: true });
            expect(() => {
                engine.flushStateUpdates();
            }).toThrowError(/Batch Flush Guard/);

            expect(engine._pendingBatchChanges.size).toBe(0);
            expect(engine._isFlushing).toBe(false);
        });

        it("should allow multi-pass cascading batch updates up to the safe configured threshold", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="step" type="number">1</state>
                    </data_model>
                    <div>{data.step}</div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // A finite, healthy 3-step cascade: 1 -> 2 -> 3 -> stop
            engine.watch("step", (val) => {
                if (val < 3) {
                    engine.setState("step", val + 1, { batch: true });
                }
            });

            engine.setState("step", 2, { batch: true });
            engine.flushStateUpdates();

            expect(engine.getState("step")).toBe(3);
            expect(engine._pendingBatchChanges.size).toBe(0);
            expect(engine._isFlushing).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // 3. Re-entrant Flush Guard Safety
    // -------------------------------------------------------------------------
    describe("3. Re-entrant flushStateUpdates Safety", () => {
        it("should safely ignore re-entrant flushStateUpdates calls while already flushing", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="ping" type="number">0</state>
                    </data_model>
                    <div>{data.ping}</div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            let reentrantCalled = false;

            engine.watch("ping", () => {
                if (!reentrantCalled) {
                    reentrantCalled = true;
                    // Attempt nested re-entrant flush
                    engine.flushStateUpdates();
                }
            });

            engine.setState("ping", 10, { batch: true });
            expect(() => engine.flushStateUpdates()).not.toThrow();
            expect(reentrantCalled).toBe(true);
            expect(engine.getState("ping")).toBe(10);
            expect(engine._isFlushing).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // 4. Unmounted Engine Zombie Microtask Protection
    // -------------------------------------------------------------------------
    describe("4. Unmounted Engine Zombie Microtask Protection", () => {
        it("should safely discard scheduled microtask flush when engine is unmounted before microtask runs", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="score" type="number">0</state>
                    </data_model>
                    <div id="target">{data.score}</div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const watcherSpy = vi.fn();
            engine.watch("score", watcherSpy);

            // Queue a batch change (schedules a microtask)
            engine.setState("score", 99, { batch: true });
            expect(engine._microtaskScheduled).toBe(true);

            // Immediately destroy the engine before microtask fires
            engine.destroy();
            expect(engine._isMounted).toBe(false);
            expect(engine._pendingBatchChanges.size).toBe(0);
            expect(engine._microtaskScheduled).toBe(false);

            // Wait for microtask turn
            await new Promise((r) => queueMicrotask(r));

            // Watcher should NOT be called after unmount
            expect(watcherSpy).not.toHaveBeenCalled();
            // Container should remain cleanly empty/reset
            expect(container.innerHTML).toBe("");
        });

        it("should no-op flushStateUpdates if explicitly called on destroyed engine", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status" type="string">active</state>
                    </data_model>
                    <div>{data.status}</div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            engine.destroy();

            // Calling flushStateUpdates on destroyed engine does not throw or mutate DOM
            expect(() => engine.flushStateUpdates()).not.toThrow();
            expect(engine._dirtyBitmask).toBe(0n);
        });
    });

    // -------------------------------------------------------------------------
    // 5. Configurable Thresholds & Custom Limits
    // -------------------------------------------------------------------------
    describe("5. Configurable Depth Limits", () => {
        it("should respect custom _maxMicrotaskDepth set on engine instance", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="k" type="number">0</state>
                    </data_model>
                    <div>{data.k}</div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const reportedErrors = [];
            engine.onError = (e) => reportedErrors.push(e);

            // Configure custom limit: 4
            engine._maxMicrotaskDepth = 4;

            engine.watch("k", (val) => {
                queueMicrotask(() => {
                    engine.setState("k", val + 1, { batch: true });
                });
            });

            engine.setState("k", 1, { batch: true });

            await new Promise((r) => setTimeout(r, 40));

            expect(reportedErrors.length).toBeGreaterThan(0);
            const err = reportedErrors.find((e) => e.code === "MICROTASK_CASCADE_LIMIT_EXCEEDED");
            expect(err).toBeDefined();
            expect(err.message).toMatch(/limit exceeded/i);
            expect(err.message).toContain("recursive microtasks");
        });
    });
});
