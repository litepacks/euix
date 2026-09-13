import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXApiPlugin } from "../src/plugins/EUIXApiPlugin.js";
import { EUIXLeafletPlugin } from "../src/plugins/EUIXLeafletPlugin.js";
import { renderToString } from "../src/server/index.js";

describe("Category 2 & 3 Fixes Test Suite", () => {
    describe("API Plugin sessionStorage cleanup in clearApiCache", () => {
        it("should clear both localStorage and sessionStorage cached items", () => {
            const engine = new EUIXEngine();
            localStorage.setItem("euix_api_test_tag", JSON.stringify({ data: { a: 1 }, timestamp: Date.now() }));
            sessionStorage.setItem("euix_api_test_tag", JSON.stringify({ data: { b: 2 }, timestamp: Date.now() }));
            localStorage.setItem("euix_api_other_tag", JSON.stringify({ data: { c: 3 }, timestamp: Date.now() }));
            sessionStorage.setItem("euix_api_other_tag", JSON.stringify({ data: { d: 4 }, timestamp: Date.now() }));

            // Clear specific tag
            engine.clearApiCache("test_tag");
            expect(localStorage.getItem("euix_api_test_tag")).toBeNull();
            expect(sessionStorage.getItem("euix_api_test_tag")).toBeNull();
            expect(localStorage.getItem("euix_api_other_tag")).not.toBeNull();
            expect(sessionStorage.getItem("euix_api_other_tag")).not.toBeNull();

            // Clear all
            engine.clearApiCache();
            expect(localStorage.getItem("euix_api_other_tag")).toBeNull();
            expect(sessionStorage.getItem("euix_api_other_tag")).toBeNull();
        });

        it("should safely serialize Headers and Map objects when enqueuing offline mutations", () => {
            const engine = new EUIXEngine();
            const headersMap = new Map([
                ["Authorization", "Bearer sample-token"],
                ["Content-Type", "application/json"],
            ]);

            engine._enqueueOfflineMutation({
                url: "/api/offline-test",
                method: "POST",
                headers: headersMap,
                body: JSON.stringify({ action: "create" }),
            });

            const queueRaw = localStorage.getItem("euix_api_offline_queue");
            expect(queueRaw).toBeTruthy();
            const queue = JSON.parse(queueRaw);
            expect(queue.length).toBeGreaterThan(0);
            const item = queue[queue.length - 1];
            expect(item.url).toBe("/api/offline-test");
            expect(item.headers["Authorization"]).toBe("Bearer sample-token");
            expect(item.headers["Content-Type"]).toBe("application/json");
        });
    });

    describe("Leaflet Map Lifecycle & Memory Teardown", () => {
        it("should register destroy hooks and clean up Leaflet map instance upon engine unmount", async () => {
            const container = document.createElement("div");
            document.body.appendChild(container);

            // Mock Leaflet on window
            let removeCalled = false;
            window.L = {
                map: vi.fn(() => ({
                    _layersMap: new Map(),
                    addLayer: vi.fn(),
                    remove: vi.fn(() => {
                        removeCalled = true;
                    }),
                    on: vi.fn(),
                    getCenter: () => ({ lat: 41.0082, lng: 28.9784 }),
                    getZoom: () => 12,
                    invalidateSize: vi.fn(),
                })),
                tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
                FeatureGroup: vi.fn(function () {
                    this.eachLayer = vi.fn();
                    this.addLayer = vi.fn();
                }),
                Draw: { Event: { CREATED: "draw:created" } },
            };

            const xml = `
                <uid_spec>
                    <leaflet_map id="test_map_unmount" lat="41.0082" lng="28.9784" zoom="12" />
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            // Allow setTimeout(initMapInstance, 0) to execute
            await new Promise((r) => setTimeout(r, 50));

            expect(engine._leafletMaps.has("test_map_unmount")).toBe(true);

            // Trigger unmount
            engine.destroy();

            expect(removeCalled).toBe(true);
            expect(engine._leafletMaps.has("test_map_unmount")).toBe(false);

            delete window.L;
            container.remove();
        });
    });

    describe("SSR Server Renderer Enhancements & Cache", () => {
        it("should support dynamic expression based for_each items in renderToString", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="users" type="array">[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"},{"id":3,"name":"Charlie"}]</state>
                    </data_model>
                    <for_each items="{data.users.slice(0, 2)}" var="u">
                        <div class="user-row">{u.name}</div>
                    </for_each>
                </uid_spec>
            `;

            const html = renderToString(xml);
            expect(html).toContain("Alice");
            expect(html).toContain("Bob");
            expect(html).not.toContain("Charlie");
        });

        it("should evaluate conditional SSR expressions rapidly with compiled cache", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="score" type="number">85</state>
                    </data_model>
                    <if condition="data.score &gt; 50">
                        <span>Passed</span>
                    </if>
                </uid_spec>
            `;

            const html = renderToString(xml);
            expect(html).toContain("Passed");
        });

        it("should render modular <component_def> and project <slot /> / <children /> in SSR", () => {
            const xml = `
                <uid_spec>
                    <component_def name="user-badge">
                        <div class="badge">
                            <strong>{props.username}</strong>
                            <span>({props.role})</span>
                            <div class="badge-content">
                                <children />
                            </div>
                        </div>
                    </component_def>

                    <div class="profile">
                        <component name="user-badge" username="Ahmet" role="Admin">
                            <em>Verified Member</em>
                        </component>
                    </div>
                </uid_spec>
            `;

            const html = renderToString(xml);
            expect(html).toContain("Ahmet");
            expect(html).toContain("(Admin)");
            expect(html).toContain("<em>Verified Member</em>");
            expect(html).not.toContain("<component_def");
        });

        it("should render <collapse> layout tags in SSR with semantic headers", () => {
            const xml = `
                <uid_spec>
                    <collapse title="Account Settings">
                        <p>User details and preferences</p>
                    </collapse>
                </uid_spec>
            `;

            const html = renderToString(xml);
            expect(html).toContain("euix-collapse");
            expect(html).toContain("Account Settings");
            expect(html).toContain("User details and preferences");
        });
    });
});
