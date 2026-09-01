import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXApiPlugin } from "../src/plugins/EUIXApiPlugin.js";
import { EUIXRouterPlugin } from "../src/plugins/router/index.js";
import { EUIXDragDropPlugin } from "../src/plugins/EUIXDragDropPlugin.js";
import { EUIXLeafletPlugin } from "../src/plugins/EUIXLeafletPlugin.js";

describe("Category 1 Critical Fixes Test Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    // -------------------------------------------------------------------------
    // 1. Array Mutations: REVERSE, SORT, MOVE_UP, MOVE_DOWN
    // -------------------------------------------------------------------------
    describe("1.1 Array Mutations (REVERSE, SORT, MOVE_UP, MOVE_DOWN)", () => {
        it("should correctly REVERSE array state", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="items" type="array">[1, 2, 3, 4, 5]</state>
                    </data_model>
                    <button id="btn-reverse">
                        <on_click action="MUTATE_STATE">
                            <path>items</path>
                            <operation>REVERSE</operation>
                        </on_click>
                        Reverse
                    </button>
                </uid_spec>
            `;
            const engine = EUIXEngine.mount(xml, container);
            expect(engine.getState("items")).toEqual([1, 2, 3, 4, 5]);

            const btn = container.querySelector("#btn-reverse");
            btn.click();
            expect(engine.getState("items")).toEqual([5, 4, 3, 2, 1]);
        });

        it("should correctly SORT array state by field ascending and descending", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="users" type="array">[
                            {"id": 1, "name": "Charlie", "age": 30},
                            {"id": 2, "name": "Alice", "age": 22},
                            {"id": 3, "name": "Bob", "age": 45}
                        ]</state>
                    </data_model>
                    <button id="btn-sort-name">
                        <on_click action="MUTATE_STATE">
                            <path>users</path>
                            <operation>SORT</operation>
                            <by>name</by>
                            <order>asc</order>
                        </on_click>
                    </button>
                    <button id="btn-sort-age-desc">
                        <on_click action="MUTATE_STATE">
                            <path>users</path>
                            <operation>SORT</operation>
                            <by>age</by>
                            <order>desc</order>
                        </on_click>
                    </button>
                </uid_spec>
            `;
            const engine = EUIXEngine.mount(xml, container);

            // Sort by name asc
            container.querySelector("#btn-sort-name").click();
            const names = engine.getState("users").map((u) => u.name);
            expect(names).toEqual(["Alice", "Bob", "Charlie"]);

            // Sort by age desc
            container.querySelector("#btn-sort-age-desc").click();
            const ages = engine.getState("users").map((u) => u.age);
            expect(ages).toEqual([45, 30, 22]);
        });

        it("should correctly MOVE_UP and MOVE_DOWN items by index and where condition", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="tasks" type="array">[
                            {"id": "a", "title": "First"},
                            {"id": "b", "title": "Second"},
                            {"id": "c", "title": "Third"}
                        ]</state>
                    </data_model>
                </uid_spec>
            `;
            const engine = EUIXEngine.mount(xml, container);

            // Move item "c" (index 2) UP -> should be at index 1
            engine.mutateState("tasks", "MOVE_UP", { where: { field: "id", equals: "c" } });
            expect(engine.getState("tasks").map((t) => t.id)).toEqual(["a", "c", "b"]);

            // Move item at index 0 DOWN -> should be at index 1
            engine.mutateState("tasks", "MOVE_DOWN", { index: 0 });
            expect(engine.getState("tasks").map((t) => t.id)).toEqual(["c", "a", "b"]);
        });
    });

    // -------------------------------------------------------------------------
    // 2. REVALIDATE Action: Router vs API Hybrid Resolution
    // -------------------------------------------------------------------------
    describe("1.2 REVALIDATE Action Hybrid Resolution", () => {
        it("should route REVALIDATE action to API endpoint when tag is specified", async () => {
            const engine = EUIXEngineCore
                .use(EUIXApiPlugin)
                .use(EUIXRouterPlugin)
                .mount(`
                    <uid_spec>
                        <api_config>
                            <api_endpoint id="posts" tag="get_posts" url="/api/posts" auto_fetch="false" />
                        </api_config>
                        <router>
                            <route path="/" id="home_route" title="Home" />
                        </router>
                        <button id="btn-reval-api">
                            <on_click action="REVALIDATE" tag="get_posts" />
                        </button>
                    </uid_spec>
                `, container);

            const revalSpy = vi.spyOn(engine, "revalidateApi").mockResolvedValue(true);
            const btn = container.querySelector("#btn-reval-api");
            btn.click();

            expect(revalSpy).toHaveBeenCalledWith("get_posts");
        });

        it("should route REVALIDATE action to Router when route is specified", async () => {
            const engine = EUIXEngineCore
                .use(EUIXApiPlugin)
                .use(EUIXRouterPlugin)
                .mount(`
                    <uid_spec>
                        <router>
                            <route path="/dashboard" id="dashboard_route" title="Dashboard" />
                        </router>
                        <button id="btn-reval-route">
                            <on_click action="REVALIDATE" route="dashboard_route" />
                        </button>
                    </uid_spec>
                `, container);

            if (engine.router) {
                const routeSpy = vi.spyOn(engine.router, "revalidate").mockResolvedValue(true);
                container.querySelector("#btn-reval-route").click();
                expect(routeSpy).toHaveBeenCalledWith("dashboard_route");
            }
        });
    });

    // -------------------------------------------------------------------------
    // 3. API Numeric Data Precision & Type Preservation
    // -------------------------------------------------------------------------
    describe("1.3 API Numeric Data Precision", () => {
        it("should preserve float precision and native number type in API responses", async () => {
            const originalFetch = globalThis.fetch;
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers({ "content-type": "application/json" }),
                json: async () => ({
                    gpsLatitude: 41.0082376,
                    cryptoBalance: 0.00012345,
                    counter: 42,
                }),
                text: async () => JSON.stringify({
                    gpsLatitude: 41.0082376,
                    cryptoBalance: 0.00012345,
                    counter: 42,
                }),
            });

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="latitude" type="number">0</state>
                        <state id="balance" type="number">0</state>
                    </data_model>
                    <api_config>
                        <api_endpoint id="get_geo" url="/api/geo" select="gpsLatitude" target="latitude" auto_fetch="true" />
                        <api_endpoint id="get_bal" url="/api/bal" select="cryptoBalance" target="balance" auto_fetch="true" />
                    </api_config>
                </uid_spec>
            `;

            try {
                const engine = EUIXEngineCore.use(EUIXApiPlugin).mount(xml, container);
                await new Promise((r) => setTimeout(r, 50));

                expect(engine.getState("latitude")).toBe(41.0082376);
                expect(typeof engine.getState("latitude")).toBe("number");

                expect(engine.getState("balance")).toBe(0.00012345);
                expect(typeof engine.getState("balance")).toBe("number");
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });

    // -------------------------------------------------------------------------
    // 4. Drag & Drop Generic Context Variable Support
    // -------------------------------------------------------------------------
    describe("1.4 Drag & Drop Generic Item Identification", () => {
        it("should identify dragged id with custom loop variable names like 'card' or 'item'", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="cards" type="array">[
                            {"id": "card-99", "title": "Payment Card"}
                        ]</state>
                        <state id="dragged_id" type="string"></state>
                    </data_model>
                    <container>
                        <for_each items="{data.cards}" var="card">
                            <div class="drag-item" draggable="true">
                                <span>{card.title}</span>
                            </div>
                        </for_each>
                    </container>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXDragDropPlugin).mount(xml, container);
            const dragEl = container.querySelector(".drag-item");
            expect(dragEl).not.toBeNull();

            // Simulate dragstart event
            const dragStartEvt = new Event("dragstart", { bubbles: true, cancelable: true });
            dragStartEvt.dataTransfer = {
                setData: vi.fn(),
                effectAllowed: "move",
            };
            dragEl.dispatchEvent(dragStartEvt);

            expect(engine.getState("dragged_id")).toBe("card-99");
        });
    });

    // -------------------------------------------------------------------------
    // 5. Leaflet Map Status State Isolation
    // -------------------------------------------------------------------------
    describe("1.5 Leaflet Status State Isolation", () => {
        it("should not overwrite global data.status unless status_target is explicitly specified", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status">Active Order #123</state>
                        <state id="geo_items" type="array">[]</state>
                    </data_model>
                    <leaflet_map bind="geo_items" id="map1" />
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXLeafletPlugin).mount(xml, container);

            // data.status must remain untouched
            expect(engine.getState("status")).toBe("Active Order #123");
        });
    });
});
