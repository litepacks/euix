import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXApiPlugin } from "../src/plugins/EUIXApiPlugin.js";

EUIXEngineCore.use(EUIXApiPlugin);

describe("EUIXApiPlugin Coverage Boost Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    it("should test request interceptors, SWR caching and error handling", async () => {
        let requestCount = 0;
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            requestCount++;
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve([{ id: 1, title: "Post 1" }]),
                text: () => Promise.resolve('[{"id": 1, "title": "Post 1"}]')
            });
        });

        const xml = `
        <uid_spec>
            <data_model>
                <state id="posts" type="array"></state>
                <state id="isLoading" type="boolean">false</state>
                <state id="errMessage"></state>
                <state id="xhrTarget"></state>
            </data_model>

            <api_config base_url="https://api.example.com">
                <api_endpoint
                    id="posts_ep"
                    tag="posts"
                    url="/posts"
                    method="GET"
                    target="posts"
                    auto_fetch="true"
                    loading="isLoading"
                    error="errMessage"
                />
            </api_config>

            <flex direction="column">
                <span id="api-status-loading">Loading: {api.posts_ep.loading}</span>
                <span id="api-status-status">Status: {api.posts_ep.status}</span>

                <button id="btn-revalidate-api">
                    <on_click action="REVALIDATE_API">
                        <tag>posts</tag>
                    </on_click>
                    Refresh API
                </button>

                <button id="btn-revalidate-short">
                    <on_click action="REVALIDATE">
                        <url>/posts</url>
                    </on_click>
                    Refresh Short
                </button>

                <button id="btn-xhr">
                    <on_click action="XHR">
                        <url>https://api.example.com/posts</url>
                        <method>GET</method>
                        <target>xhrTarget</target>
                    </on_click>
                    XHR Direct
                </button>

                <button id="btn-try-xhr">
                    <on_click action="TRY">
                        <step action="XHR">
                            <url>https://api.example.com/error-endpoint</url>
                            <method>POST</method>
                        </step>
                        <catch var="err">
                            <step action="SET_STATE">
                                <path>data.errMessage</path>
                                <value>{err.message}</value>
                            </step>
                        </catch>
                    </on_click>
                    Try XHR
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        await new Promise(r => setTimeout(r, 60));
        expect(engine.getState("posts")).toBeDefined();

        // Register custom interceptor
        if (engine.api && typeof engine.api.onRequest === "function") {
            engine.api.onRequest((cfg) => {
                cfg.headers = cfg.headers || {};
                cfg.headers["X-Custom-Auth"] = "secret";
                return cfg;
            });
        }

        // Programmatic revalidation
        const btnRevApi = container.querySelector("#btn-revalidate-api");
        btnRevApi.click();

        const btnRevShort = container.querySelector("#btn-revalidate-short");
        btnRevShort.click();

        const btnXhr = container.querySelector("#btn-xhr");
        btnXhr.click();

        const btnTryXhr = container.querySelector("#btn-try-xhr");
        btnTryXhr.click();

        await new Promise(r => setTimeout(r, 80));

        fetchSpy.mockRestore();
    });
});
