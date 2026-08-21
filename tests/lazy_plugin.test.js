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
});
