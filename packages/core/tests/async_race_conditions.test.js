/**
 * packages/core/tests/async_race_conditions.test.js
 * Test suite for Item 6: Async Race Conditions, Request Stamping & Out-of-Order Responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXApiPlugin } from "../src/plugins/EUIXApiPlugin.js";

describe("Item 6: Async Race Conditions, Request Stamping & Out-of-Order Responses", () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXApiPlugin);
        container = document.createElement("div");
        container.id = "app";
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // 1. Out-of-Order Response Discarding (Stale Overwrite Protection)
    // -------------------------------------------------------------------------
    describe("1. Out-of-Order Response Discarding", () => {
        it("should drop slow older response when a faster newer response has already updated the target state", async () => {
            // Request 1 will be slow (resolves in 100ms) with { query: "apple", result: "Apple Result" }
            // Request 2 will be fast (resolves in 20ms) with { query: "banana", result: "Banana Result" }
            global.fetch = vi.fn().mockImplementation((url) => {
                if (url.includes("q=apple")) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                ok: true,
                                status: 200,
                                headers: new Headers({ "content-type": "application/json" }),
                                json: async () => ({ result: "Apple Result" }),
                            });
                        }, 100);
                    });
                }
                if (url.includes("q=banana")) {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                ok: true,
                                status: 200,
                                headers: new Headers({ "content-type": "application/json" }),
                                json: async () => ({ result: "Banana Result" }),
                            });
                        }, 20);
                    });
                }
                return Promise.reject(new Error("Unknown URL"));
            });

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="search_query" type="string"></state>
                        <state id="search_result" type="string">None</state>
                        <state id="err_state" type="string"></state>
                    </data_model>
                    <api_config base_url="https://api.example.com">
                        <api_endpoint id="search_ep" tag="search_tag" url="/search?q={data.search_query}" method="GET" bind_target="search_result" select="result" error="err_state" auto_fetch="false" abort_previous="false" />
                    </api_config>
                    <flex direction="column">
                        <span id="result_text">{data.search_result}</span>
                    </flex>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // Step 1: Trigger Request 1 (slow, q=apple)
            engine.setState("search_query", "apple");
            const p1 = engine.revalidateApi("search_tag");

            // Step 2: Shortly after, trigger Request 2 (fast, q=banana)
            await new Promise((r) => setTimeout(r, 10));
            engine.setState("search_query", "banana");
            const p2 = engine.revalidateApi("search_tag");

            // Wait for both promises to settle
            await Promise.all([p1, p2]);

            // Wait an extra tick to ensure all microtasks and batches have settled
            await new Promise((r) => setTimeout(r, 120));

            // The state MUST be "Banana Result" because Request 1 arrived out-of-order and must be dropped
            expect(engine.getState("search_result")).toBe("Banana Result");
        });
    });

    // -------------------------------------------------------------------------
    // 2. AbortController Superseding In-Flight Requests
    // -------------------------------------------------------------------------
    describe("2. AbortController Superseding In-Flight Requests", () => {
        it("should abort previous in-flight request when a new request is triggered for the same target", async () => {
            const abortSignals = [];

            global.fetch = vi.fn().mockImplementation((url, options) => {
                if (options && options.signal) {
                    abortSignals.push(options.signal);
                }
                return new Promise((resolve, reject) => {
                    if (options && options.signal) {
                        options.signal.addEventListener("abort", () => {
                            reject(new DOMException("The user aborted a request.", "AbortError"));
                        });
                    }
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            headers: new Headers({ "content-type": "application/json" }),
                            json: async () => ({ data: "resolved" }),
                        });
                    }, 80);
                });
            });

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="target_val" type="string">initial</state>
                        <state id="req_error" type="string"></state>
                    </data_model>
                    <api_config base_url="https://api.example.com">
                        <api_endpoint id="data_ep" tag="data_tag" url="/data" method="GET" bind_target="target_val" select="data" error="req_error" auto_fetch="false" abort_previous="true" />
                    </api_config>
                    <div>
                        <span>{data.target_val}</span>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // Trigger Request 1
            const p1 = engine.revalidateApi("data_tag");

            // Check that first signal is not yet aborted
            expect(abortSignals.length).toBe(1);
            expect(abortSignals[0].aborted).toBe(false);

            // Rapidly trigger Request 2 before Request 1 finishes
            await new Promise((r) => setTimeout(r, 10));
            const p2 = engine.revalidateApi("data_tag");

            // Check that first signal was immediately aborted with superseded reason
            expect(abortSignals.length).toBe(2);
            expect(abortSignals[0].aborted).toBe(true);
            expect(abortSignals[1].aborted).toBe(false);

            await Promise.all([p1, p2]);
            await new Promise((r) => setTimeout(r, 100));

            // Final state should be the resolved value from Request 2
            expect(engine.getState("target_val")).toBe("resolved");

            // Aborted request 1 should NOT set req_error
            expect(engine.getState("req_error")).toBe("");
        });
    });

    // -------------------------------------------------------------------------
    // 3. In-Flight Request Deduplication (SWR Sharing)
    // -------------------------------------------------------------------------
    describe("3. In-Flight Request Deduplication", () => {
        it("should deduplicate concurrent GET requests to the same URL, firing fetch only once", async () => {
            let fetchCallCount = 0;

            global.fetch = vi.fn().mockImplementation(() => {
                fetchCallCount++;
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            headers: new Headers({ "content-type": "application/json" }),
                            json: async () => ({ value: "shared_data" }),
                        });
                    }, 50);
                });
            });

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="target_a" type="string"></state>
                        <state id="target_b" type="string"></state>
                        <state id="err_ep" type="string"></state>
                    </data_model>
                    <api_config base_url="https://api.example.com">
                        <api_endpoint id="ep_a" tag="shared_tag" url="/shared-resource" method="GET" bind_target="target_a" select="value" error="err_ep" auto_fetch="false" deduplicate="true" />
                        <api_endpoint id="ep_b" tag="shared_tag" url="/shared-resource" method="GET" bind_target="target_b" select="value" error="err_ep" auto_fetch="false" deduplicate="true" />
                    </api_config>
                    <div>
                        <span>{data.target_a}</span>
                        <span>{data.target_b}</span>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // Revalidate "shared_tag", which triggers both ep_a and ep_b simultaneously to the exact same URL
            await engine.revalidateApi("shared_tag");
            await new Promise((r) => setTimeout(r, 70));

            // Both endpoints should have received the data
            expect(engine.getState("target_a")).toBe("shared_data");
            expect(engine.getState("target_b")).toBe("shared_data");

            // Fetch should have been called only ONCE due to in-flight deduplication
            expect(fetchCallCount).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    // 4. Teardown / Unmount Request Abort & State Immunity
    // -------------------------------------------------------------------------
    describe("4. Teardown / Unmount Request Abort", () => {
        it("should abort all pending in-flight requests and prevent state mutations after engine.destroy()", async () => {
            let aborted = false;

            global.fetch = vi.fn().mockImplementation((url, options) => {
                if (options && options.signal) {
                    options.signal.addEventListener("abort", () => {
                        aborted = true;
                    });
                }
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            headers: new Headers({ "content-type": "application/json" }),
                            json: async () => ({ value: "should_not_be_written" }),
                        });
                    }, 80);
                });
            });

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status_val" type="string">initial</state>
                        <state id="err_slow" type="string"></state>
                    </data_model>
                    <api_config base_url="https://api.example.com">
                        <api_endpoint id="slow_ep" tag="slow_tag" url="/slow" method="GET" bind_target="status_val" select="value" error="err_slow" auto_fetch="false" />
                    </api_config>
                    <div>
                        <span>{data.status_val}</span>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // Start in-flight request
            engine.revalidateApi("slow_tag");

            // Destroy the engine while request is in flight
            await new Promise((r) => setTimeout(r, 20));
            engine.destroy();

            // The in-flight request signal should be aborted immediately
            expect(aborted).toBe(true);

            // Wait for network timeout to pass
            await new Promise((r) => setTimeout(r, 100));

            // State must remain "initial" and never be overwritten post-destroy
            expect(engine.getState("status_val")).toBe("initial");
        });
    });

    // -------------------------------------------------------------------------
    // 5. Configurable Deduplication Opt-Out & Mutation Isolation
    // -------------------------------------------------------------------------
    describe("5. Deduplication Opt-Out & Mutation Isolation", () => {
        it("should NOT deduplicate GET requests when deduplicate='false'", async () => {
            let fetchCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                fetchCount++;
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            headers: new Headers({ "content-type": "application/json" }),
                            json: async () => ({ value: "independent" }),
                        });
                    }, 30);
                });
            });

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="target_x" type="string"></state>
                        <state id="target_y" type="string"></state>
                        <state id="err_xy" type="string"></state>
                    </data_model>
                    <api_config base_url="https://api.example.com">
                        <api_endpoint id="ep_x" tag="no_dedup" url="/resource" method="GET" bind_target="target_x" error="err_xy" auto_fetch="false" deduplicate="false" />
                        <api_endpoint id="ep_y" tag="no_dedup" url="/resource" method="GET" bind_target="target_y" error="err_xy" auto_fetch="false" deduplicate="false" />
                    </api_config>
                    <div>
                        <span>{data.target_x}</span>
                        <span>{data.target_y}</span>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            await engine.revalidateApi("no_dedup");
            await new Promise((r) => setTimeout(r, 60));

            // Should have fired 2 separate network requests
            expect(fetchCount).toBe(2);
        });

        it("should NEVER deduplicate POST mutations even with identical URLs", async () => {
            let postCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                postCount++;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    headers: new Headers({ "content-type": "application/json" }),
                    json: async () => ({ success: true }),
                });
            });

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="post_res" type="string">initial</state>
                    </data_model>
                    <div>
                        <button id="post_btn">
                            <on_click action="XHR">
                                <url>https://api.example.com/mutation</url>
                                <method>POST</method>
                                <body>{"data":"1"}</body>
                                <target>post_res</target>
                            </on_click>
                        </button>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const btn = container.querySelector("#post_btn");

            // Rapidly click twice
            btn.click();
            btn.click();
            await new Promise((r) => setTimeout(r, 50));

            expect(postCount).toBe(2);
        });
    });

    // -------------------------------------------------------------------------
    // 6. Declarative Shorthand Revalidation Race Condition Protection
    // -------------------------------------------------------------------------
    describe("6. Declarative Shorthand Revalidation", () => {
        it("should protect against race conditions when triggered via on_click:revalidate", async () => {
            let callOrder = 0;
            global.fetch = vi.fn().mockImplementation((url) => {
                callOrder++;
                const order = callOrder;
                return new Promise((resolve) => {
                    // First call is slow, second call is fast
                    const delay = order === 1 ? 80 : 20;
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            headers: new Headers({ "content-type": "application/json" }),
                            json: async () => ({ value: order === 1 ? "Slow First" : "Fast Second" }),
                        });
                    }, delay);
                });
            });

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="reval_result" type="string"></state>
                        <state id="err_reval" type="string"></state>
                    </data_model>
                    <api_config base_url="https://api.example.com">
                        <api_endpoint id="dynamic_ep" tag="user_search" url="/search" method="GET" bind_target="reval_result" select="value" error="err_reval" auto_fetch="false" abort_previous="false" deduplicate="false" />
                    </api_config>
                    <flex direction="column">
                        <button id="reval_btn" on_click:revalidate="user_search" aria-label="Refresh">Refresh</button>
                        <span id="display">{data.reval_result}</span>
                    </flex>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const btn = container.querySelector("#reval_btn");

            // Click 1 (Slow)
            btn.click();
            // Short delay, then Click 2 (Fast)
            await new Promise((r) => setTimeout(r, 10));
            btn.click();

            // Wait for both to complete
            await new Promise((r) => setTimeout(r, 120));

            // Must preserve "Fast Second" and ignore stale "Slow First"
            expect(engine.getState("reval_result")).toBe("Fast Second");
        });
    });
});
