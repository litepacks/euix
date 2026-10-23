/**
 * tests/profiler_plugin_and_devtools.test.js
 * Comprehensive unit and integration test suite for Item 6:
 * DevTools & Profiler Decoupling and Hook-Driven Instrumentation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXEngine } from "../src/EUIXEngine.js";
import {
    EUIXProfilerPlugin,
    getPerformanceMetrics,
    getBindingsStats,
    _getTestStats,
    updateDevToolsStatus,
    enableDevTools,
} from "../src/plugins/EUIXProfilerPlugin.js";

describe("Item 6: DevTools & Profiler Decoupling Suite", () => {
    beforeEach(() => {
        if (typeof window !== "undefined") {
            delete window.__EUIX_DEVTOOLS__;
        }
    });

    afterEach(() => {
        if (typeof window !== "undefined") {
            delete window.__EUIX_DEVTOOLS__;
        }
    });

    describe("EUIXProfilerPlugin Lifecycle & Hooks", () => {
        it("should install EUIXProfilerPlugin and listen to engine:init and engine:mount hooks", () => {
            const container = document.createElement("div");
            const xml = `<uid_spec><flex><h1>Hello Profiler</h1></flex></uid_spec>`;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine).toBeDefined();

            // Mount duration should be recorded
            expect(typeof engine._mountDuration).toBe("number");
            expect(engine._mountDuration).toBeGreaterThanOrEqual(0);
        });

        it("should handle devtools:status hook events and update window.__EUIX_DEVTOOLS__", () => {
            const container = document.createElement("div");
            const engine = EUIXEngineCore.mount(`<uid_spec><div>Test</div></uid_spec>`, container);

            expect(global.window.__EUIX_DEVTOOLS__).toBeDefined();
            expect(global.window.__EUIX_DEVTOOLS__.ready).toBe(true);

            // Emit hook event directly
            engine.hooks.emit("devtools:status", { key: "pendingActions", deltaOrValue: 3 });
            expect(global.window.__EUIX_DEVTOOLS__.pendingActions).toBe(3);
            expect(global.window.__EUIX_DEVTOOLS__.ready).toBe(false);

            // Release pending actions
            engine.hooks.emit("devtools:status", { key: "pendingActions", deltaOrValue: -3 });
            expect(global.window.__EUIX_DEVTOOLS__.pendingActions).toBe(0);
            expect(global.window.__EUIX_DEVTOOLS__.ready).toBe(true);
        });

        it("should clamp numeric devtools status values to 0 when negative delta exceeds current", () => {
            const container = document.createElement("div");
            const engine = EUIXEngineCore.mount(`<uid_spec><div>Clamp Test</div></uid_spec>`, container);

            engine._updateDevToolsStatus("pendingLoaders", 1);
            expect(global.window.__EUIX_DEVTOOLS__.pendingLoaders).toBe(1);

            engine._updateDevToolsStatus("pendingLoaders", -10);
            expect(global.window.__EUIX_DEVTOOLS__.pendingLoaders).toBe(0);
        });
    });

    describe("ActionDispatcher DevTools Hook Coordination", () => {
        it("should track pending actions during asynchronous action execution", async () => {
            const container = document.createElement("div");
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="val" type="number">0</state>
                </data_model>
                <button id="btn">
                    <on_click action="SET_STATE">
                        <path>data.val</path>
                        <value>10</value>
                    </on_click>
                    Click Me
                </button>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const btn = container.querySelector("#btn");

            expect(global.window.__EUIX_DEVTOOLS__.pendingActions).toBe(0);

            // Trigger action
            btn.click();
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect(engine.state.val).toBe(10);
            expect(global.window.__EUIX_DEVTOOLS__.pendingActions).toBe(0);
            expect(global.window.__EUIX_DEVTOOLS__.ready).toBe(true);
        });
    });

    describe("Performance Metrics & Diagnostics", () => {
        it("should collect performance metrics via getPerformanceMetrics", () => {
            const container = document.createElement("div");
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="count" type="number">1</state>
                    <state id="name">Alice</state>
                </data_model>
                <div>
                    <span>{data.name}</span>
                    <span>{data.count}</span>
                </div>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const metrics = getPerformanceMetrics(engine, EUIXEngineCore);

            expect(metrics).toBeDefined();
            expect(metrics.activeBindingsCount).toBeGreaterThanOrEqual(2);
            expect(metrics.boundElementsCount).toBeGreaterThanOrEqual(1);
            expect(metrics.rawStateKeysCount).toBeGreaterThanOrEqual(2);
            expect(metrics.astCache).toBeDefined();
            expect(metrics.astCache.size).toBeGreaterThanOrEqual(1);
            expect(typeof metrics.expressionCacheSize).toBe("number");
        });

        it("should safely handle empty or null engine in getPerformanceMetrics and _getTestStats", () => {
            const emptyMetrics = getPerformanceMetrics(null, null);
            expect(emptyMetrics).toBeDefined();
            expect(emptyMetrics.mountDuration).toBe(0);
            expect(emptyMetrics.astCache).toBeNull();
            expect(emptyMetrics.componentsCount).toBe(0);

            const emptyTestStats = _getTestStats({});
            expect(emptyTestStats.activeIntervals).toBe(0);
            expect(emptyTestStats.activeWatchers).toBe(0);
            expect(emptyTestStats.activeSubscriptions).toBe(0);
        });
    });

    describe("Full Bundle Integration", () => {
        it("should include EUIXProfilerPlugin automatically in EUIXEngine", () => {
            expect(EUIXEngine.EUIXProfilerPlugin).toBe(EUIXProfilerPlugin);
            expect(global.window.EUIXProfilerPlugin).toBe(EUIXProfilerPlugin);
        });
    });
});
