import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXLazyPlugin } from "../src/plugins/EUIXLazyPlugin.js";
import { EUIXRouterPlugin } from "../src/plugins/EUIXRouterPlugin.js";

EUIXEngineCore.use(EUIXLazyPlugin);
EUIXEngineCore.use(EUIXRouterPlugin);

describe("EUIXLazyPlugin Unit Tests", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        EUIXEngineCore._lazyRegistry.clear();
        EUIXEngineCore._lazyPromises.clear();
    });

    it("should register lazy components via <import lazy='true' /> without fetching immediately", () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => 
            Promise.resolve({
                text: () => Promise.resolve('<component_def name="lazy-card"><div>Lazy Card Loaded</div></component_def>')
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="lazy-card" src="components/LazyCard.xml" lazy="true" />
            </imports>
            <div>Initial Page Content</div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();
        expect(EUIXEngineCore._lazyRegistry.has("lazy-card")).toBe(true);

        // Fetch should NOT have been called on mount
        expect(fetchSpy).not.toHaveBeenCalled();

        fetchSpy.mockRestore();
    });

    it("should display placeholder and asynchronously replace with loaded component when rendered", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => 
            Promise.resolve({
                text: () => Promise.resolve('<component_def name="lazy-widget"><div class="loaded-widget">Widget Content</div></component_def>')
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="lazy-widget" src="components/LazyWidget.xml" lazy="true" />
            </imports>
            <div>
                <lazy-widget />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        // Initially placeholder exists
        const placeholder = container.querySelector(".euix-lazy-placeholder");
        expect(placeholder).not.toBeNull();

        // Wait for async load and replacement
        await new Promise(r => setTimeout(r, 60));

        const loadedEl = container.querySelector(".loaded-widget");
        expect(loadedEl).not.toBeNull();
        expect(loadedEl.textContent).toBe("Widget Content");

        fetchSpy.mockRestore();
    });

    it("should load lazy components seamlessly through EUIX Web Router outlet", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => 
            Promise.resolve({
                text: () => Promise.resolve('<component_def name="lazy-route-view"><div class="lazy-route-content">Lazy Route Loaded!</div></component_def>')
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="lazy-route-view" src="components/LazyRouteView.xml" lazy="true" />
            </imports>
            <router mode="memory" initial_entries="['/']">
                <route path="/" component="lazy-route-view" />
            </router>
            <outlet />
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        await new Promise(r => setTimeout(r, 80));

        const contentEl = container.querySelector(".lazy-route-content");
        expect(contentEl).not.toBeNull();
        expect(contentEl.textContent).toBe("Lazy Route Loaded!");

        fetchSpy.mockRestore();
    });

    it("should initialize component data model on demand when lazy loaded", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => 
            Promise.resolve({
                text: () => Promise.resolve(`
                    <component_def name="lazy-state-comp">
                        <data_model>
                            <state id="lazy_counter" type="number">42</state>
                            <state id="lazy_user">Alice</state>
                        </data_model>
                        <div class="state-result">User: {data.lazy_user}, Counter: {data.lazy_counter}</div>
                    </component_def>
                `)
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="lazy-state-comp" src="components/LazyStateComp.xml" lazy="true" />
            </imports>
            <div id="wrapper">
                <lazy-state-comp />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        await new Promise(r => setTimeout(r, 80));

        const resultEl = container.querySelector(".state-result");
        expect(resultEl).not.toBeNull();
        expect(resultEl.textContent).toContain("User: Alice, Counter: 42");
        expect(engine.getState("lazy_counter")).toBe(42);
        expect(engine.getState("lazy_user")).toBe("Alice");

        fetchSpy.mockRestore();
    });

    it("should mount and evaluate lazy date section with helper functions", async () => {
        const { EUIXDatePlugin } = await import("../src/plugins/EUIXDatePlugin.js");
        EUIXEngineCore.use(EUIXDatePlugin);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => 
            Promise.resolve({
                text: () => Promise.resolve(`
                    <component_def name="test-date-comp">
                        <data_model>
                            <state id="test_date">2026-08-20T14:30:00Z</state>
                            <state id="test_locale">en-US</state>
                        </data_model>
                        <div class="date-output">
                            <span class="days">{$date.daysInMonth(data.test_date)}</span>
                            <span class="leap">{$date.isLeapYear(data.test_date) ? 'Leap' : 'Common'}</span>
                        </div>
                    </component_def>
                `)
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="test-date-comp" src="components/TestDateComp.xml" lazy="true" />
            </imports>
            <div id="app-root">
                <test-date-comp />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        await new Promise(r => setTimeout(r, 80));

        const daysEl = container.querySelector(".days");
        const leapEl = container.querySelector(".leap");
        expect(daysEl).not.toBeNull();
        expect(daysEl.textContent).toBe("31");
        expect(leapEl).not.toBeNull();
        expect(leapEl.textContent).toBe("Common");

        fetchSpy.mockRestore();
    });

    it("should mount and evaluate lazy navigator section with $device properties", async () => {
        const { EUIXNavigatorPlugin } = await import("../src/plugins/EUIXNavigatorPlugin.js");
        EUIXEngineCore.use(EUIXNavigatorPlugin);

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => 
            Promise.resolve({
                text: () => Promise.resolve(`
                    <component_def name="test-nav-comp">
                        <div class="nav-output">
                            <span class="online-status">{$device.online ? 'ONLINE' : 'OFFLINE'}</span>
                            <span class="cores-count">{$device.hardwareConcurrency || 8}</span>
                        </div>
                    </component_def>
                `)
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="test-nav-comp" src="components/TestNavComp.xml" lazy="true" />
            </imports>
            <div id="app-root-nav">
                <test-nav-comp />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        await new Promise(r => setTimeout(r, 80));

        const directInterpolate = engine.interpolate("{$device.hardwareConcurrency || 8}");
        expect(directInterpolate).toMatch(/\d+/);

        const onlineEl = container.querySelector(".online-status");
        const coresEl = container.querySelector(".cores-count");
        expect(onlineEl).not.toBeNull();
        expect(onlineEl.textContent).toBe("ONLINE");
        expect(coresEl).not.toBeNull();
        expect(coresEl.textContent).toMatch(/\d+/);

        fetchSpy.mockRestore();
    });

    it("should defer loading until placeholder intersects viewport when IntersectionObserver is available", async () => {
        let observeCallback = null;
        let observedTarget = null;
        let unobservedTarget = null;

        class MockIntersectionObserver {
            constructor(callback, options) {
                observeCallback = callback;
                this.options = options;
            }
            observe(el) {
                observedTarget = el;
            }
            unobserve(el) {
                unobservedTarget = el;
            }
            disconnect() {}
        }

        const originalIO = globalThis.IntersectionObserver;
        globalThis.IntersectionObserver = MockIntersectionObserver;

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
            Promise.resolve({
                text: () => Promise.resolve('<component_def name="viewport-comp"><div class="viewport-loaded">Viewport Content</div></component_def>')
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="viewport-comp" src="components/ViewportComp.xml" lazy="true" viewport="true" root_margin="300px" />
            </imports>
            <div>
                <viewport-comp />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        await new Promise(r => setTimeout(r, 20));

        // Observed target should be the placeholder, and fetch should NOT yet be called
        expect(observedTarget).not.toBeNull();
        expect(observedTarget.getAttribute("data-euix-lazy-component")).toBe("viewport-comp");
        expect(fetchSpy).not.toHaveBeenCalled();

        // Simulate intersection event (scrolling into view)
        observeCallback([{ isIntersecting: true, target: observedTarget }]);

        await new Promise(r => setTimeout(r, 60));

        // Now component should be loaded and hydrated
        expect(fetchSpy).toHaveBeenCalled();
        const loadedEl = container.querySelector(".viewport-loaded");
        expect(loadedEl).not.toBeNull();
        expect(loadedEl.textContent).toBe("Viewport Content");

        fetchSpy.mockRestore();
        globalThis.IntersectionObserver = originalIO;
    });

    it("should respect lazy='true' on nested imports inside loaded parent components without eager fetching", async () => {
        const fetchedUrls = [];
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
            fetchedUrls.push(url);
            if (url.includes("ParentSection.xml")) {
                return Promise.resolve({
                    text: () => Promise.resolve(`
                        <component_def name="parent-section">
                            <imports>
                                <import name="child-one" src="components/ChildOne.xml" lazy="true" viewport="true" />
                                <import name="child-two" src="components/ChildTwo.xml" lazy="true" viewport="true" />
                            </imports>
                            <div>
                                <child-one />
                                <child-two />
                            </div>
                        </component_def>
                    `)
                });
            }
            if (url.includes("ChildOne.xml")) {
                return Promise.resolve({
                    text: () => Promise.resolve('<component_def name="child-one"><div>Child 1</div></component_def>')
                });
            }
            if (url.includes("ChildTwo.xml")) {
                return Promise.resolve({
                    text: () => Promise.resolve('<component_def name="child-two"><div>Child 2</div></component_def>')
                });
            }
            return Promise.reject(new Error(`Unknown URL: ${url}`));
        });

        // Load the parent component asynchronously
        await EUIXEngineCore.loadComponent("parent-section", "components/ParentSection.xml");

        // Only ParentSection.xml should have been fetched
        expect(fetchedUrls).toEqual(["components/ParentSection.xml"]);
        expect(EUIXEngineCore._lazyRegistry.has("child-one")).toBe(true);
        expect(EUIXEngineCore._lazyRegistry.has("child-two")).toBe(true);

        fetchSpy.mockRestore();
    });

    it("should apply CLS layout reservation styles (min-height, aspect-ratio) to placeholder", () => {
        const xml = `
        <uid_spec>
            <imports>
                <import name="cls-card" src="components/ClsCard.xml" lazy="true" min_height="320px" aspect_ratio="16/9" placeholder_class="custom-skeleton" />
            </imports>
            <div>
                <cls-card />
            </div>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        const placeholder = container.querySelector(".euix-lazy-placeholder");
        expect(placeholder).not.toBeNull();
        expect(placeholder.style.minHeight).toBe("320px");
        expect(placeholder.style.aspectRatio).toMatch(/16\s*\/?\s*9/);
        expect(placeholder.classList.contains("custom-skeleton")).toBe(true);
    });

    it("should trigger prefetch on hover/focus when preload='hover'", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
            Promise.resolve({
                text: () => Promise.resolve('<component_def name="hover-comp"><div class="hover-loaded">Hover Content</div></component_def>')
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="hover-comp" src="components/HoverComp.xml" lazy="true" preload="hover" />
            </imports>
            <div>
                <hover-comp />
            </div>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        const placeholder = container.querySelector(".euix-lazy-placeholder");
        expect(placeholder).not.toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();

        // Simulate mouse enter
        placeholder.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

        await new Promise((r) => setTimeout(r, 60));
        expect(fetchSpy).toHaveBeenCalled();

        fetchSpy.mockRestore();
    });

    it("should display interactive retry button on failure and recover when clicked", async () => {
        let shouldFail = true;
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            if (shouldFail) {
                return Promise.reject(new Error("Network connection dropped"));
            }
            return Promise.resolve({
                text: () => Promise.resolve('<component_def name="retry-card"><div class="retry-success">Card Recovered!</div></component_def>')
            });
        });

        const xml = `
        <uid_spec>
            <imports>
                <import name="retry-card" src="components/RetryCard.xml" lazy="true" />
            </imports>
            <div>
                <retry-card />
            </div>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        await new Promise((r) => setTimeout(r, 60));

        // Placeholder should show error UI with Retry button
        const retryBtn = container.querySelector(".euix-lazy-retry-btn");
        expect(retryBtn).not.toBeNull();
        expect(container.textContent).toContain("Failed to load retry-card");

        // Allow subsequent fetch to succeed and click retry button
        shouldFail = false;
        retryBtn.click();

        await new Promise((r) => setTimeout(r, 80));
        const recoveredEl = container.querySelector(".retry-success");
        expect(recoveredEl).not.toBeNull();
        expect(recoveredEl.textContent).toBe("Card Recovered!");

        fetchSpy.mockRestore();
    });

    it("should track metrics in window.__EUIX_DEVTOOLS__.metrics.lazyLoads", async () => {
        window.__EUIX_DEVTOOLS__ = { pendingLoaders: 0, metrics: { lazyLoads: [] } };

        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
            Promise.resolve({
                text: () => Promise.resolve('<component_def name="telemetry-comp"><div class="telemetry-box">Box</div></component_def>')
            })
        );

        const xml = `
        <uid_spec>
            <imports>
                <import name="telemetry-comp" src="components/TelemetryComp.xml" lazy="true" />
            </imports>
            <div>
                <telemetry-comp />
            </div>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        await new Promise((r) => setTimeout(r, 60));

        const metrics = window.__EUIX_DEVTOOLS__.metrics.lazyLoads;
        expect(metrics.length).toBeGreaterThan(0);
        const record = metrics.find((m) => m.name === "telemetry-comp");
        expect(record).toBeDefined();
        expect(record.success).toBe(true);
        expect(record.duration).toBeGreaterThanOrEqual(0);

        fetchSpy.mockRestore();
    });

    it("should automatically retry on transient failure when retries is configured", async () => {
        let attempts = 0;
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
            attempts++;
            if (attempts < 3) {
                return Promise.reject(new Error("Transient network glitch"));
            }
            return Promise.resolve({
                text: () => Promise.resolve('<component_def name="auto-retry-comp"><div class="auto-retry-box">Recovered Automatically!</div></component_def>')
            });
        });

        const xml = `
        <uid_spec>
            <imports>
                <import name="auto-retry-comp" src="components/AutoRetryComp.xml" lazy="true" retries="3" retry_delay="50" />
            </imports>
            <div>
                <auto-retry-comp />
            </div>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        await new Promise((r) => setTimeout(r, 350));

        expect(attempts).toBe(3);
        const box = container.querySelector(".auto-retry-box");
        expect(box).not.toBeNull();
        expect(box.textContent).toBe("Recovered Automatically!");

        fetchSpy.mockRestore();
    });
});



