import { describe, test, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { isEqual, deepClone } from "../src/core/utils/constants.js";

describe("Item 2: Reference vs. Value Equality (Deep/Structural Equality & Loop Prevention)", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "app";
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        document.body.innerHTML = "";
        vi.restoreAllMocks();
    });

    describe("1. Utility Primitives: isEqual & deepClone", () => {
        it("should correctly compare primitives, null, and undefined", () => {
            expect(isEqual(1, 1)).toBe(true);
            expect(isEqual(1, 2)).toBe(false);
            expect(isEqual("abc", "abc")).toBe(true);
            expect(isEqual("abc", "def")).toBe(false);
            expect(isEqual(true, true)).toBe(true);
            expect(isEqual(true, false)).toBe(false);
            expect(isEqual(null, null)).toBe(true);
            expect(isEqual(undefined, undefined)).toBe(true);
            expect(isEqual(null, undefined)).toBe(false);
            expect(isEqual(NaN, NaN)).toBe(true);
            expect(isEqual(0, -0)).toBe(true);
        });

        it("should deep compare arrays and nested objects", () => {
            const objA = { a: 1, b: [2, 3], c: { d: "hello" } };
            const objB = { a: 1, b: [2, 3], c: { d: "hello" } };
            const objC = { a: 1, b: [2, 4], c: { d: "hello" } };

            expect(isEqual(objA, objB)).toBe(true);
            expect(isEqual(objA, objC)).toBe(false);
            expect(isEqual([1, 2, [3, 4]], [1, 2, [3, 4]])).toBe(true);
            expect(isEqual([1, 2, [3, 4]], [1, 2, [3, 5]])).toBe(false);
        });

        it("should handle Date and RegExp equality", () => {
            const d1 = new Date(1700000000000);
            const d2 = new Date(1700000000000);
            const d3 = new Date(1700000000001);
            expect(isEqual(d1, d2)).toBe(true);
            expect(isEqual(d1, d3)).toBe(false);

            const r1 = /test/gi;
            const r2 = /test/gi;
            const r3 = /test/g;
            expect(isEqual(r1, r2)).toBe(true);
            expect(isEqual(r1, r3)).toBe(false);
        });

        it("should safely deep clone objects without mutating original", () => {
            const original = { user: { name: "Alice", tags: ["admin", "dev"] } };
            const clone = deepClone(original);

            expect(clone).toEqual(original);
            expect(clone).not.toBe(original);
            expect(clone.user).not.toBe(original.user);
            expect(clone.user.tags).not.toBe(original.user.tags);

            clone.user.tags.push("tester");
            expect(original.user.tags).toEqual(["admin", "dev"]);
        });
    });

    describe("2. Primitive State De-duplication in setState", () => {
        it("should skip redundant computed invalidation, syncBindings, and watchers when primitive value is identical", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="count" type="number">0</state>
                        <computed id="isZero" deps="count">
                            <![CDATA[return $data.count === 0;]]>
                        </computed>
                    </data_model>
                    <container>
                        <span id="label">{data.count}</span>
                        <span id="zero">{data.isZero}</span>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const watcherFn = vi.fn();
            engine.watch("count", watcherFn);

            const syncSpy = vi.spyOn(engine, "syncBindings");

            // Re-setting count to 0 (identical)
            engine.setState("count", 0);

            // Redundant update must be suppressed
            expect(watcherFn).not.toHaveBeenCalled();
            expect(syncSpy).not.toHaveBeenCalled();

            // Explicit force: true should bypass de-duplication
            engine.setState("count", 0, { force: true });
            expect(watcherFn).toHaveBeenCalledTimes(1);
            expect(syncSpy).toHaveBeenCalled();
        });
    });

    describe("3. Structural Object & Array Equality in setState", () => {
        it("should NOT trigger watchers or DOM updates when a new object literal with identical content is set", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="config" type="object">{"theme": "dark", "layout": "grid"}</state>
                    </data_model>
                    <container>
                        <div id="theme-view">{data.config.theme}</div>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const watcherFn = vi.fn();
            engine.watch("config", watcherFn);

            const syncSpy = vi.spyOn(engine, "syncBindings");

            // Pass a completely new object reference with identical content
            engine.setState("config", { theme: "dark", layout: "grid" });

            // Must NOT trigger watcher or syncBindings
            expect(watcherFn).not.toHaveBeenCalled();
            expect(syncSpy).not.toHaveBeenCalled();

            // Now pass an object with different content
            engine.setState("config", { theme: "light", layout: "grid" });
            expect(watcherFn).toHaveBeenCalledTimes(1);
            expect(syncSpy).toHaveBeenCalled();
            expect(engine.getState("config.theme")).toBe("light");
        });

        it("should allow in-place mutations when mutated: true is passed", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="items" type="array">[{"id": 1, "text": "Task 1"}]</state>
                    </data_model>
                    <container>
                        <span id="count">{data.items.length}</span>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const watcherFn = vi.fn();
            engine.watch("items", watcherFn);

            const current = engine.getState("items");
            current.push({ id: 2, text: "Task 2" });

            // Calling setState with mutated: true on the same array reference
            engine.setState("items", current, { mutated: true });

            expect(watcherFn).toHaveBeenCalledTimes(1);
            expect(engine.getState("items").length).toBe(2);
        });
    });

    describe("4. Preventing Ping-Pong / Cross-Watcher Infinite Loops", () => {
        it("should terminate cross-watcher state synchronization without WATCHER_CYCLE_ERROR due to structural equality", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="primary_filter" type="object">{"status": "active"}</state>
                        <state id="secondary_filter" type="object">{"status": "all"}</state>
                    </data_model>
                    <watch path="primary_filter">
                        <step action="RUN_SCRIPT"><![CDATA[
                            $engine.setState("secondary_filter", { status: $newValue.status });
                        ]]></step>
                    </watch>
                    <watch path="secondary_filter">
                        <step action="RUN_SCRIPT"><![CDATA[
                            $engine.setState("primary_filter", { status: $newValue.status });
                        ]]></step>
                    </watch>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);

            // Without structural equality, this would loop primary -> secondary -> primary -> secondary until crash!
            expect(() => {
                engine.setState("primary_filter", { status: "pending" });
            }).not.toThrow();

            expect(engine.getState("primary_filter.status")).toBe("pending");
            expect(engine.getState("secondary_filter.status")).toBe("pending");
        });
    });

    describe("5. Computed Property Structural Reference Retention", () => {
        it("should preserve cached reference and avoid downstream watcher triggers when computed returns structurally identical array", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="count" type="number">10</state>
                        <state id="tags" type="array">["react", "euix"]</state>
                        <computed id="sortedTags" deps="tags, count"><![CDATA[
                            return $data.tags.slice().sort();
                        ]]></computed>
                    </data_model>
                    <watch path="computed.sortedTags">
                        <step action="RUN_SCRIPT"><![CDATA[
                            window._sortedWatchCount = (window._sortedWatchCount || 0) + 1;
                        ]]></step>
                    </watch>
                    <container>
                        <span id="tags">{data.sortedTags}</span>
                    </container>
                </uid_spec>
            `;

            window._sortedWatchCount = 0;
            const engine = EUIXEngine.mount(xml, container);

            // Change unrelated dependency 'count':
            // 'sortedTags' evaluates again, but its result ["euix", "react"] is structurally identical!
            engine.setState("count", 20);

            // Watcher on computed.sortedTags must NOT fire because its value did not change!
            expect(window._sortedWatchCount).toBe(0);

            // Now actually change tags
            engine.setState("tags", ["vue", "angular"]);
            expect(window._sortedWatchCount).toBe(1);

            delete window._sortedWatchCount;
        });
    });

    describe("6. Scoped State De-duplication", () => {
        it("should avoid redundant binding sync when setting identical scoped local state", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="activeTab">home</state>
                    </data_model>
                    <container>
                        <span id="tab">{data.activeTab}</span>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const context = { _localState: { activeTab: "home" }, _instanceId: "inst_1" };

            const syncSpy = vi.spyOn(engine, "syncBindings");

            // Setting local.activeTab to 'home' when it is already 'home'
            engine._setScopedState("local.activeTab", "activeTab", "home", context);

            expect(syncSpy).not.toHaveBeenCalled();

            // Changing local.activeTab to 'settings'
            engine._setScopedState("local.activeTab", "activeTab", "settings", context);
            expect(syncSpy).toHaveBeenCalledWith("inst_1:activeTab", "settings");
        });
    });
});
