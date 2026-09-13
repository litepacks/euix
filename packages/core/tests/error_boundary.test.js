import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { renderToString } from "../src/server/index.js";

describe("Declarative <error_boundary> Template Tag Suite", () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        container = document.getElementById("app");
    });

    it("renders valid children normally inside <error_boundary>", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="username">Alice</state>
                </data_model>
                <div>
                    <error_boundary name="UserBoundary" fallback="Failed to load user">
                        <h2 class="user-heading">Welcome, {data.username}!</h2>
                    </error_boundary>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const heading = container.querySelector(".user-heading");
        expect(heading).not.toBeNull();
        expect(heading.textContent).toBe("Welcome, Alice!");

        const boundary = engine.getErrorBoundary("UserBoundary");
        expect(boundary).toBeDefined();
        expect(boundary.hasError).toBe(false);
    });

    it("renders attribute fallback string when an error is caught", () => {
        const xml = `
            <uid_spec>
                <div>
                    <error_boundary name="AttrBoundary" fallback="Error: {error.message}">
                        <div class="main-body">Normal text</div>
                    </error_boundary>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(container.querySelector(".main-body")).not.toBeNull();

        engine.catchErrorBoundary("AttrBoundary", new Error("Service Unavailable"));

        const boundary = engine.getErrorBoundary("AttrBoundary");
        expect(boundary.hasError).toBe(true);
        expect(boundary.error.message).toBe("Service Unavailable");

        const fallback = container.querySelector(".euix-error-fallback");
        expect(fallback).not.toBeNull();
        expect(fallback.textContent).toBe("Error: Service Unavailable");
    });

    it("renders rich <fallback let='err'> template and exposes scoped error properties", () => {
        const xml = `
            <uid_spec>
                <div>
                    <error_boundary name="RichBoundary">
                        <div class="secure-area">Top Secret</div>
                        <fallback let="err">
                            <div class="alert alert-danger">
                                <span class="err-title">CRASH: {err.message}</span>
                                <span class="err-code">Code: {err.code}</span>
                            </div>
                        </fallback>
                    </error_boundary>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(container.querySelector(".secure-area")).not.toBeNull();

        const customErr = new Error("Access Denied");
        customErr.code = "AUTH_403";
        engine.catchErrorBoundary("RichBoundary", customErr);

        expect(container.querySelector(".secure-area")).toBeNull();
        expect(container.querySelector(".err-title").textContent).toBe("CRASH: Access Denied");
        expect(container.querySelector(".err-code").textContent).toBe("Code: AUTH_403");
    });

    it("supports <template slot='fallback'> syntax", () => {
        const xml = `
            <uid_spec>
                <error_boundary name="SlotBoundary">
                    <div class="widget">Widget Content</div>
                    <template slot="fallback" let="error">
                        <div class="slot-fallback">{error.message}</div>
                    </template>
                </error_boundary>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(container.querySelector(".widget")).not.toBeNull();

        engine.catchErrorBoundary("SlotBoundary", new Error("Render Failed"));
        expect(container.querySelector(".slot-fallback").textContent).toBe("Render Failed");
    });

    it("retries and restores main content on on_click:retry='BoundaryName'", () => {
        const xml = `
            <uid_spec>
                <error_boundary name="RetryBoundary">
                    <div class="app-view">App View Active</div>
                    <fallback let="err">
                        <div class="error-view">
                            <p>{err.message}</p>
                            <button class="retry-btn" on_click:retry="RetryBoundary">Try Again</button>
                        </div>
                    </fallback>
                </error_boundary>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(container.querySelector(".app-view")).not.toBeNull();

        engine.catchErrorBoundary("RetryBoundary", new Error("Temporary Glitch"));
        expect(container.querySelector(".app-view")).toBeNull();
        expect(container.querySelector(".error-view")).not.toBeNull();

        const btn = container.querySelector(".retry-btn");
        btn.click();

        expect(container.querySelector(".error-view")).toBeNull();
        expect(container.querySelector(".app-view")).not.toBeNull();
        expect(engine.getErrorBoundary("RetryBoundary").hasError).toBe(false);
    });

    it("retries via generic RESET_ERROR_BOUNDARY action without naming the boundary", () => {
        const xml = `
            <uid_spec>
                <error_boundary name="AutoResetBoundary">
                    <span class="live-data">Live Feed</span>
                    <fallback>
                        <div class="error-pane">
                            <button class="auto-reset-btn" on_click="RESET_ERROR_BOUNDARY">Reset</button>
                        </div>
                    </fallback>
                </error_boundary>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        engine.catchErrorBoundary("AutoResetBoundary", new Error("Disconnected"));

        expect(container.querySelector(".error-pane")).not.toBeNull();

        container.querySelector(".auto-reset-btn").click();
        expect(container.querySelector(".live-data")).not.toBeNull();
    });

    it("emits error:boundary hook and logs to devtools when error is caught", () => {
        const xml = `
            <uid_spec>
                <error_boundary name="HookBoundary" fallback="Failed">
                    <div>Content</div>
                </error_boundary>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        let hookPayload = null;
        engine.hooks.on("error:boundary", (p) => {
            hookPayload = p;
        });

        engine.catchErrorBoundary("HookBoundary", new Error("Hook Test Error"));

        expect(hookPayload).not.toBeNull();
        expect(hookPayload.name).toBe("HookBoundary");
        expect(hookPayload.error.message).toBe("Hook Test Error");
    });

    it("triggers on_error declarative action handler when error is caught", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="alert_count" type="number">0</state>
                </data_model>
                <div>
                    <error_boundary name="ActionBoundary" on_error="alert_count={data.alert_count + 1}" fallback="Crash">
                        <div class="active">Running</div>
                    </error_boundary>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine.getState("alert_count")).toBe(0);

        engine.catchErrorBoundary("ActionBoundary", new Error("State Trigger Error"));
        expect(engine.getState("alert_count")).toBe(1);
    });

    it("isolates nested error boundaries so inner crashes do not affect outer boundary", () => {
        const xml = `
            <uid_spec>
                <error_boundary name="OuterBoundary" fallback="Outer Failed">
                    <div class="outer-content">
                        <h2>Outer Header</h2>
                        <error_boundary name="InnerBoundary" fallback="Inner Failed">
                            <div class="inner-content">Inner Safe</div>
                        </error_boundary>
                    </div>
                </error_boundary>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(container.querySelector(".outer-content")).not.toBeNull();
        expect(container.querySelector(".inner-content")).not.toBeNull();

        engine.catchErrorBoundary("InnerBoundary", new Error("Inner Crash"));

        // Outer boundary remains intact
        expect(container.querySelector(".outer-content")).not.toBeNull();
        expect(container.querySelector(".inner-content")).toBeNull();
        expect(container.textContent).toContain("Outer Header");
        expect(container.textContent).toContain("Inner Failed");
    });

    it("finds closest error boundary from an inner child element", () => {
        const xml = `
            <uid_spec>
                <error_boundary name="FindMeBoundary">
                    <div class="card">
                        <span id="target-child">Target Text</span>
                    </div>
                </error_boundary>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const child = container.querySelector("#target-child");
        const found = engine.findClosestErrorBoundary(child);

        expect(found).not.toBeNull();
        expect(found.name).toBe("FindMeBoundary");
    });

    it("supports programmatic reset and catch error on engine", () => {
        const xml = `
            <uid_spec>
                <error_boundary name="ProgBoundary" fallback="Prog Error">
                    <div class="content">Fine</div>
                </error_boundary>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine.catchErrorBoundary("ProgBoundary", new Error("Manual Throw"))).toBe(true);
        expect(container.textContent).toContain("Prog Error");

        expect(engine.resetErrorBoundary("ProgBoundary")).toBe(true);
        expect(container.textContent).toContain("Fine");
    });

    it("renders error boundary cleanly in Server-Side Rendering (SSR)", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="heading">Server Page</state>
                </data_model>
                <error_boundary class="card-boundary" fallback="SSR Error: {error.message}">
                    <h1>{data.heading}</h1>
                </error_boundary>
            </uid_spec>
        `;

        const html = renderToString(xml);
        expect(html).toContain('class="euix-error-boundary card-boundary"');
        expect(html).toContain("<h1>Server Page</h1>");
    });
});
