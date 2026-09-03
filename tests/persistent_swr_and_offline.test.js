// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXApiPlugin } from "../src/plugins/EUIXApiPlugin.js";
import { JSDOM } from "jsdom";

describe("Persistent SWR API Cache & Offline Queue Suite", () => {
    let dom;
    let container;

    beforeEach(() => {
        dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"app\"></div></body></html>", {
            url: "http://localhost:3000"
        });
        global.document = dom.window.document;
        global.window = dom.window;
        global.DOMParser = dom.window.DOMParser;
        global.localStorage = dom.window.localStorage;
        global.sessionStorage = dom.window.sessionStorage;
        global.navigator = dom.window.navigator;
        localStorage.clear();
        sessionStorage.clear();
        container = document.getElementById("app");

        EUIXEngineCore.use(EUIXApiPlugin);
    });

    afterEach(() => {
        if (container) container.innerHTML = "";
        vi.restoreAllMocks();
    });

    it("should write API response to persistent storage when persist='localStorage'", async () => {
        const mockPosts = [
            { id: 1, title: "Persistent Post 1" },
            { id: 2, title: "Persistent Post 2" }
        ];

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => mockPosts
        });

        const xml = `
        <uid_spec>
          <data_model>
            <state id="posts" type="array">[]</state>
          </data_model>

          <api_config base_url="https://api.example.com">
            <api_endpoint 
              id="get_posts"
              url="/posts" 
              method="GET" 
              target="posts"
              persist="localStorage"
              cache_ttl="60000"
            />
          </api_config>

          <for_each items="{data.posts}" var="p" key="id">
            <span class="post-item">{p.title}</span>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        await new Promise((r) => setTimeout(r, 50));

        expect(engine.getState("posts").length).toBe(2);
        expect(container.querySelectorAll(".post-item").length).toBe(2);

        // Check persistent localStorage write
        const stored = localStorage.getItem("euix_api_get_posts");
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored);
        expect(parsed.data).toEqual(mockPosts);
    });

    it("should load stale data immediately from persistent storage when network is offline", async () => {
        const cachedData = [{ id: 99, title: "Cached Offline Post" }];
        localStorage.setItem("euix_api_get_posts", JSON.stringify({
            data: cachedData,
            timestamp: Date.now()
        }));

        // Mock offline navigator
        Object.defineProperty(global.navigator, "onLine", {
            value: false,
            configurable: true
        });

        global.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

        const xml = `
        <uid_spec>
          <data_model>
            <state id="posts" type="array">[]</state>
          </data_model>

          <api_config base_url="https://api.example.com">
            <api_endpoint 
              id="get_posts"
              url="/posts" 
              method="GET" 
              target="posts"
              persist="localStorage"
              cache_ttl="60000"
            />
          </api_config>

          <for_each items="{data.posts}" var="p" key="id">
            <span class="offline-post">{p.title}</span>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        // Instantly rendered from persistent cache
        expect(engine.getState("posts").length).toBe(1);
        expect(container.querySelector(".offline-post").textContent).toBe("Cached Offline Post");

        const status = engine.getApiStatus("get_posts");
        expect(status.isOffline).toBe(true);
    });

    it("should enqueue offline mutations and flush them when online", async () => {
        Object.defineProperty(global.navigator, "onLine", {
            value: false,
            configurable: true
        });

        global.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

        const xml = `
        <uid_spec>
          <data_model>
            <state id="status">pending</state>
          </data_model>

          <button class="btn-create">
            <on_click action="XHR">
              <url>https://api.example.com/posts</url>
              <method>POST</method>
              <body>{"title": "Offline Queued Post"}</body>
              <queue_offline>true</queue_offline>
            </on_click>
            Create Post
          </button>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btn = container.querySelector(".btn-create");
        btn.click();
        await new Promise((r) => setTimeout(r, 50));

        // Mutation must be enqueued in localStorage
        const rawQueue = localStorage.getItem("euix_api_offline_queue");
        expect(rawQueue).not.toBeNull();
        const queue = JSON.parse(rawQueue);
        expect(queue.length).toBe(1);
        expect(queue[0].url).toBe("https://api.example.com/posts");
        expect(queue[0].method).toBe("POST");

        // Now mock online and flush
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
        const flushResults = await engine.flushOfflineQueue();

        expect(flushResults.length).toBe(1);
        expect(flushResults[0].success).toBe(true);
        expect(localStorage.getItem("euix_api_offline_queue")).toBeNull();
    });

    it("should clear API cache using engine.clearApiCache()", async () => {
        localStorage.setItem("euix_api_test_ep", JSON.stringify({ data: [1, 2, 3], timestamp: Date.now() }));
        const engine = EUIXEngineCore.mount("<uid_spec><div /></uid_spec>", container);

        engine.clearApiCache("test_ep");
        expect(localStorage.getItem("euix_api_test_ep")).toBeNull();
    });
});
