/**
 * tests/router_navigation.test.js
 * Unit and integration tests for route guards, middleware, navigation blockers, scroll restoration, and prefetching.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXRouterPlugin, EUIXRouter, createMemoryRouter, RouterRedirect } from "../src/plugins/router/index.js";

describe("EUIX Router Navigation - Guards & Middleware", () => {
    it("should allow or reject navigation via synchronous and asynchronous route guards", async () => {
        let isAuthenticated = false;

        const routes = [
            {
                id: "admin",
                path: "admin",
                guard: "authGuard"
            },
            {
                id: "login",
                path: "login"
            }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ["/"] });

        router.guard("authGuard", () => {
            if (!isAuthenticated) {
                return router.redirect("/login");
            }
            return true;
        });

        // 1. Navigation when unauthenticated -> redirects to /login
        await router.navigate("/admin");
        expect(router.location.pathname).toBe("/login");

        // 2. Navigation when authenticated -> allowed
        isAuthenticated = true;
        await router.navigate("/admin");
        expect(router.location.pathname).toBe("/admin");
    });

    it("should execute middleware pipeline from parent to child", async () => {
        const order = [];

        const routes = [
            {
                id: "parent",
                path: "dashboard",
                middleware: "parentMiddleware",
                children: [
                    {
                        id: "child",
                        path: "analytics",
                        middleware: "childMiddleware"
                    }
                ]
            }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ["/"] });

        router.middleware("parentMiddleware", async (ctx, next) => {
            order.push("parent_enter");
            await next();
            order.push("parent_exit");
        });

        router.middleware("childMiddleware", async (ctx, next) => {
            order.push("child_enter");
            await next();
            order.push("child_exit");
        });

        await router.navigate("/dashboard/analytics");

        expect(order).toEqual(["parent_enter", "child_enter", "child_exit", "parent_exit"]);
        expect(router.location.pathname).toBe("/dashboard/analytics");
    });
});

describe("EUIX Router Navigation - Blockers & Scroll", () => {
    it("should block navigation when a blocker condition is met", async () => {
        let isDirty = true;

        const routes = [
            { id: "editor", path: "editor" },
            { id: "dashboard", path: "dashboard" }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ["/editor"] });

        // Register blocker
        router.block(() => {
            return isDirty ? "You have unsaved changes!" : false;
        });

        // Mock window.confirm to return false (user cancels navigation)
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

        const res = await router.navigate("/dashboard");
        expect(res).toBe(false);
        expect(router.location.pathname).toBe("/editor");

        // User allows navigation
        confirmSpy.mockReturnValue(true);
        const res2 = await router.navigate("/dashboard");
        expect(res2).toBe(true);
        expect(router.location.pathname).toBe("/dashboard");

        confirmSpy.mockRestore();
    });

    it("should manage scroll position history", () => {
        const router = createMemoryRouter({
            routes: [{ path: "page1" }, { path: "page2" }]
        });

        router.scrollManager.saveCurrentPosition("loc-1");
        expect(router.scrollManager._positions.has("loc-1")).toBe(true);
    });
});
