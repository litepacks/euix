import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXEngineCore, EUIXStructuredError } from "../src/core/EUIXEngineCore.js";
import { EUIXReactivePlugin, EUIXDependencyGraph, EUIXComputedNode, EUIXWatchNode } from "../src/plugins/EUIXReactivePlugin.js";

describe("EUIX Engine - Watch & Computed State Test Suite", () => {
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
    });

    describe("1. Computed State Core", () => {
        test("should evaluate single state dependency and cache result", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="count" type="number">5</state>
                        <computed id="doubleCount" deps="count">
                            return $data.count * 2;
                        </computed>
                    </data_model>
                    <container>
                        <span>{data.doubleCount}</span>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            expect(engine.getState("count")).toBe(5);
            expect(engine.getState("doubleCount")).toBe(10);
            expect(container.textContent).toContain("10");

            // Mutation triggers dirty check & recompute
            engine.setState("count", 10);
            expect(engine.getState("doubleCount")).toBe(20);
            expect(container.textContent).toContain("20");
        });

        test("should evaluate multiple dependencies", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="firstName">John</state>
                        <state id="lastName">Doe</state>
                        <computed id="fullName" deps="firstName, lastName">
                            return $data.firstName + " " + $data.lastName;
                        </computed>
                    </data_model>
                    <container>
                        <h1>{data.fullName}</h1>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            expect(engine.getState("fullName")).toBe("John Doe");

            engine.setState("lastName", "Smith");
            expect(engine.getState("fullName")).toBe("John Smith");
            expect(container.textContent).toContain("John Smith");
        });

        test("should support programmatic engine.computed registration", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="price" type="number">50</state>
                        <state id="qty" type="number">3</state>
                    </data_model>
                    <container></container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            let evalCount = 0;

            engine.computed("total", ($data) => {
                evalCount++;
                return $data.price * $data.qty;
            }, ["price", "qty"]);

            expect(engine.getState("total")).toBe(150);
            expect(evalCount).toBe(1);

            // Access again (cached, no extra evaluation)
            expect(engine.getState("total")).toBe(150);
            expect(evalCount).toBe(1);

            // Change price
            engine.setState("price", 100);
            expect(engine.getState("total")).toBe(300);
            expect(evalCount).toBe(2);
        });

        test("should support computed property depending on another computed property", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="base" type="number">10</state>
                        <computed id="double" deps="base">
                            return $data.base * 2;
                        </computed>
                        <computed id="quadruple" deps="computed.double">
                            return $data.double * 2;
                        </computed>
                    </data_model>
                    <container></container>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            expect(engine.getState("double")).toBe(20);
            expect(engine.getState("quadruple")).toBe(40);

            engine.setState("base", 5);
            expect(engine.getState("double")).toBe(10);
            expect(engine.getState("quadruple")).toBe(20);
        });

        test("should prevent mutation of read-only computed property", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="val" type="number">1</state>
                        <computed id="comp" deps="val">return $data.val + 1;</computed>
                    </data_model>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            expect(() => {
                engine.setState("comp", 100);
            }).toThrow(/Cannot mutate read-only computed property/);
        });

        test("should throw COMPUTED_MUTATION_ERROR if getter attempts to mutate state", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="a" type="number">1</state>
                        <state id="b" type="number">2</state>
                    </data_model>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            engine.computed("illegalComp", ($data, $engine) => {
                $engine.setState("b", 999);
                return $data.a;
            }, ["a"]);

            expect(() => {
                engine.getState("illegalComp");
            }).toThrow(/State mutation prohibited inside computed getter/);
        });

        test("should detect static and runtime circular computed dependencies", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="x" type="number">1</state>
                    </data_model>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);

            engine.computed("nodeA", ($data, $engine) => $engine.getState("nodeB"), ["nodeB"]);
            engine.computed("nodeB", ($data, $engine) => $engine.getState("nodeA"), ["nodeA"]);

            expect(() => {
                engine.getState("nodeA");
            }).toThrow(/Circular computed dependency detected/);
        });
    });

    describe("2. Reactive Watchers Core", () => {
        test("should watch state path and expose newValue and prevValue in script", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="username">Alice</state>
                    </data_model>
                    <watch path="username">
                        <step action="RUN_SCRIPT">
                            window._lastNew = $newValue;
                            window._lastPrev = $prevValue;
                        </step>
                    </watch>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            engine.setState("username", "Bob");
            await new Promise(r => setTimeout(r, 20));

            expect(engine.getState("username")).toBe("Bob");
            expect(window._lastNew).toBe("Bob");
            expect(window._lastPrev).toBe("Alice");

            delete window._lastNew;
            delete window._lastPrev;
        });

        test("should watch computed property changes", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="num" type="number">10</state>
                        <computed id="isEven" deps="num">
                            return $data.num % 2 === 0;
                        </computed>
                    </data_model>
                    <watch path="computed.isEven">
                        <step action="RUN_SCRIPT">
                            window._watchCount = (window._watchCount || 0) + 1;
                            window._capturedVal = $newValue;
                        </step>
                    </watch>
                </uid_spec>
            `;

            window._watchCount = 0;
            const engine = EUIXEngine.mount(xml, container);

            // Mutation changing isEven from true to false
            engine.setState("num", 11);
            await new Promise(r => setTimeout(r, 20));

            expect(window._watchCount).toBe(1);
            expect(window._capturedVal).toBe(false);

            delete window._watchCount;
            delete window._capturedVal;
        });

        test("should support programmatic engine.watch registration", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="score" type="number">0</state>
                    </data_model>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const watcherFn = vi.fn();

            const unwatch = engine.watch("score", watcherFn);

            engine.setState("score", 10);
            expect(watcherFn).toHaveBeenCalledWith(10, 0, "score", expect.objectContaining({ path: "score", newValue: 10, oldValue: 0 }));

            unwatch();
            engine.setState("score", 20);
            expect(watcherFn).toHaveBeenCalledTimes(1);
        });

        test("should protect against infinite watcher loops with WATCHER_CYCLE_ERROR", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="ping" type="number">0</state>
                        <state id="pong" type="number">0</state>
                    </data_model>
                    <watch path="ping">
                        <step action="SET_STATE">
                            <path>pong</path>
                            <value>{data.ping} + 1</value>
                        </step>
                    </watch>
                    <watch path="pong">
                        <step action="SET_STATE">
                            <path>ping</path>
                            <value>{data.pong} + 1</value>
                        </step>
                    </watch>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);

            expect(() => {
                engine.setState("ping", 1);
            }).toThrow(/Maximum watcher reaction depth/);
        });

        test("should clean up component-scoped watchers and computed properties", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="val" type="number">1</state>
                    </data_model>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);

            engine.computed("compVal", ($data) => $data.val * 10, ["val"], "MyComponent");
            engine.watch("val", () => {}, "MyComponent");

            expect(engine.getComputed("compVal")).toBe(10);
            expect(engine._computedRegistry.has("compVal")).toBe(true);

            // Dispose component reactive resources
            engine.disposeComponentReactive("MyComponent");
            expect(engine._computedRegistry.has("compVal")).toBe(false);
        });
    });

    describe("3. Integration & Plugin Modular Specs", () => {
        test("should work with modular Lite Core registration via EUIXEngineCore.use(EUIXReactivePlugin)", () => {
            EUIXEngineCore.use(EUIXReactivePlugin);

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="a" type="number">2</state>
                        <state id="b" type="number">3</state>
                        <computed id="sum" deps="a, b">
                            return $data.a + $data.b;
                        </computed>
                    </data_model>
                    <container>
                        <span>{data.sum}</span>
                    </container>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.getState("sum")).toBe(5);
            expect(container.textContent).toContain("5");
        });
    });
});
