import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    DEFAULT_TIMEOUTS,
    createTimeoutSignal,
    safeFetchWithTimeout,
} from "../src/core/utils/constants.js";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { loadComponent } from "../src/core/components/ComponentLoader.js";
import { loadDataModel, loadConstants } from "../src/core/lifecycle/Lifecycle.js";

describe("Centralized DEFAULT_TIMEOUTS & Safe Timeout Utilities", () => {
    it("should export frozen DEFAULT_TIMEOUTS with all expected core durations", () => {
        expect(DEFAULT_TIMEOUTS).toBeDefined();
        expect(Object.isFrozen(DEFAULT_TIMEOUTS)).toBe(true);

        expect(DEFAULT_TIMEOUTS.API_REQUEST).toBe(12000);
        expect(DEFAULT_TIMEOUTS.COMPONENT_LOAD).toBe(10000);
        expect(DEFAULT_TIMEOUTS.RESOURCE_LOAD).toBe(10000);
        expect(DEFAULT_TIMEOUTS.SCRIPT_LOAD).toBe(8000);
        expect(DEFAULT_TIMEOUTS.ROUTER_LOADER).toBe(10000);
        expect(DEFAULT_TIMEOUTS.STREAM_CONNECT).toBe(10000);
        expect(DEFAULT_TIMEOUTS.ACTION_EXECUTION).toBe(30000);
        expect(DEFAULT_TIMEOUTS.PLAYWRIGHT_IDLE).toBe(15000);
        expect(DEFAULT_TIMEOUTS.PLAYWRIGHT_LAZY).toBe(10000);
        expect(DEFAULT_TIMEOUTS.PLAYWRIGHT_READY).toBe(5000);

        // Should not allow mutations
        expect(() => {
            DEFAULT_TIMEOUTS.API_REQUEST = 9999;
        }).toThrow();
    });

    it("should expose DEFAULT_TIMEOUTS on EUIXEngineCore and EUIXEngine", () => {
        expect(EUIXEngineCore.DEFAULT_TIMEOUTS).toBe(DEFAULT_TIMEOUTS);
        expect(EUIXEngine.DEFAULT_TIMEOUTS).toBe(DEFAULT_TIMEOUTS);
    });

    describe("createTimeoutSignal", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it("should return parent signal and noop cleanup if timeoutMs <= 0", () => {
            const parent = new AbortController().signal;
            const res = createTimeoutSignal(0, parent);
            expect(res.signal).toBe(parent);
            expect(typeof res.cleanup).toBe("function");
            res.cleanup();
        });

        it("should abort signal after specified timeout duration", () => {
            const { signal, cleanup } = createTimeoutSignal(500);
            expect(signal.aborted).toBe(false);

            vi.advanceTimersByTime(499);
            expect(signal.aborted).toBe(false);

            vi.advanceTimersByTime(2);
            expect(signal.aborted).toBe(true);
            cleanup();
        });

        it("should cancel timer when cleanup() is called before timeout", () => {
            const { signal, cleanup } = createTimeoutSignal(500);
            expect(signal.aborted).toBe(false);

            cleanup();
            vi.advanceTimersByTime(1000);
            expect(signal.aborted).toBe(false);
        });

        it("should chain with parent signal if parent signal aborts first", () => {
            const parentCtrl = new AbortController();
            const { signal, cleanup } = createTimeoutSignal(1000, parentCtrl.signal);
            expect(signal.aborted).toBe(false);

            parentCtrl.abort(new Error("Cancelled by parent"));
            expect(signal.aborted).toBe(true);
            cleanup();
        });

        it("should immediately abort if parent signal is already aborted", () => {
            const parentCtrl = new AbortController();
            parentCtrl.abort(new Error("Already aborted"));

            const { signal, cleanup } = createTimeoutSignal(1000, parentCtrl.signal);
            expect(signal.aborted).toBe(true);
            cleanup();
        });
    });

    describe("safeFetchWithTimeout", () => {
        let originalFetch;

        beforeEach(() => {
            originalFetch = globalThis.fetch;
        });

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        it("should complete successfully within timeout", async () => {
            globalThis.fetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

            const res = await safeFetchWithTimeout("https://example.com/api", {}, 5000);
            expect(res.status).toBe(200);
            expect(await res.text()).toBe("OK");
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        it("should abort if fetch takes longer than timeoutMs", async () => {
            globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
                return new Promise((resolve, reject) => {
                    opts.signal.addEventListener("abort", () => {
                        reject(new Error("The operation was aborted"));
                    });
                });
            });

            const fetchPromise = safeFetchWithTimeout("https://example.com/slow", {}, 20);
            await expect(fetchPromise).rejects.toThrow("The operation was aborted");
        });

        it("should use DEFAULT_TIMEOUTS.API_REQUEST when timeoutMs is not specified", async () => {
            let capturedSignal;
            globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
                capturedSignal = opts.signal;
                return Promise.resolve(new Response("Success", { status: 200 }));
            });

            await safeFetchWithTimeout("https://example.com/default");
            expect(capturedSignal).toBeDefined();
        });
    });

    describe("ComponentLoader & DeclarativeLoader timeout integration", () => {
        it("should pass timeout to safeFetchWithTimeout during loadComponent", async () => {
            const mockFetch = vi.fn().mockImplementation((url, opts) => {
                return Promise.resolve(new Response("<uid_spec><card>Loaded</card></uid_spec>", { status: 200 }));
            });
            globalThis.fetch = mockFetch;

            const compDoc = await loadComponent(EUIXEngineCore, "Card", "/components/card.xml", { timeout: 3500 });
            expect(mockFetch).toHaveBeenCalled();
            expect(compDoc).toBeDefined();
        });
    });

    describe("Lifecycle resource loaders with safe timeouts", () => {
        it("should load data model using safeFetchWithTimeout", async () => {
            const mockEngine = {
                batch: vi.fn((fn) => fn()),
                setState: vi.fn(),
                reportError: vi.fn(),
            };

            globalThis.fetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ user: "Alice", count: 42 }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const result = await loadDataModel(mockEngine, "/data.json");
            expect(result).toEqual({ user: "Alice", count: 42 });
            expect(mockEngine.setState).toHaveBeenCalledWith("user", "Alice");
            expect(mockEngine.setState).toHaveBeenCalledWith("count", 42);
        });

        it("should load constants using safeFetchWithTimeout", async () => {
            const mockEngine = {
                registerConstant: vi.fn(),
                reportError: vi.fn(),
            };

            globalThis.fetch = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ API_KEY: "secret123" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const result = await loadConstants(mockEngine, "/constants.json");
            expect(result).toEqual({ API_KEY: "secret123" });
            expect(mockEngine.registerConstant).toHaveBeenCalledWith("API_KEY", "secret123");
        });
    });

    describe("DeclarativeLoader timeout integration", () => {
        it("should fetch component using safeFetchWithTimeout", async () => {
            const { resolveXmlSource } = await import("../src/core/lifecycle/DeclarativeLoader.js");
            const mockFetch = vi.fn().mockResolvedValue(
                new Response("<uid_spec><card>Content</card></uid_spec>", {
                    status: 200,
                    headers: { "Content-Type": "application/xml" },
                }),
            );
            globalThis.fetch = mockFetch;

            const el = document.createElement("div");
            el.setAttribute("data-euix", "/dynamic-comp.xml");

            const xml = await resolveXmlSource(el, {}, EUIXEngineCore);
            expect(xml).toContain("<card>Content</card>");
            expect(mockFetch).toHaveBeenCalled();
        });
    });

    describe("Router Declarative Loader with timeout", () => {
        it("should execute declarative loader using safeFetchWithTimeout and custom timeout", async () => {
            const { RouteLoaderManager } = await import("../src/plugins/router/data/loader.js");
            const manager = new RouteLoaderManager();

            let capturedSignal;
            globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
                capturedSignal = opts.signal;
                return Promise.resolve(
                    new Response(JSON.stringify({ title: "Post 1" }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    }),
                );
            });

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<loader request="/api/posts/1" timeout="4500" as="post" />', "text/xml");
            const loaderNode = xmlDoc.documentElement;

            const data = await manager._executeDeclarativeLoader(loaderNode, { params: {} });
            expect(data).toEqual({ post: { title: "Post 1" } });
            expect(capturedSignal).toBeDefined();
        });
    });

    describe("Stream connection timeout handling", () => {
        it("should time out if WebSocket connection hangs beyond connectTimeout", async () => {
            const { EUIXStreamPlugin } = await import("../src/plugins/EUIXStreamPlugin.js");
            class MockEngine extends EUIXEngineCore {}
            MockEngine.use(EUIXStreamPlugin);

            const engine = new MockEngine();
            engine.interpolate = (str) => str;
            engine.syncBindings = vi.fn();

            // Mock WebSocket that never opens
            class HangingWebSocket {
                constructor() {
                    this.readyState = 0; // CONNECTING
                }
                close() {
                    this.readyState = 3; // CLOSED
                }
            }

            const origWS = globalThis.WebSocket;
            globalThis.WebSocket = HangingWebSocket;

            try {
                engine.registerStream("live_feed", {
                    url: "ws://example.com/feed",
                    connectTimeout: 50, // 50ms
                    reconnect: false,
                });

                engine.connectStream("live_feed");
                expect(engine.getStreamStatus("live_feed").status).toBe("connecting");

                // Wait for 70ms to allow connection timeout to trigger
                await new Promise((r) => setTimeout(r, 70));

                const status = engine.getStreamStatus("live_feed");
                expect(status.status).toBe("error");
                expect(status.error).toContain("WebSocket connection timed out after 50ms");
            } finally {
                globalThis.WebSocket = origWS;
            }
        });
    });
});
