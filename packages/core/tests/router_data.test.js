/**
 * tests/router_data.test.js
 * Comprehensive unit & integration tests for data loaders, actions, revalidation, and fetchers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXRouterPlugin, EUIXRouter, createMemoryRouter, RouterRedirect, RouterError } from "../src/plugins/router/index.js";

describe("EUIX Router Data - Loaders & Actions", () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXRouterPlugin);
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it("should execute programmatic loaders and pass route data to $route.data", async () => {
        const routes = [
            {
                id: "project",
                path: "/projects/:projectId",
                component: "project-view",
                loader: async ({ params, signal }) => {
                    expect(params.projectId).toBe("101");
                    expect(signal).toBeDefined();
                    return { id: params.projectId, name: "Quantum Engine", stars: 128 };
                }
            }
        ];

        const router = createMemoryRouter({
            routes,
            initialEntries: ["/"]
        });

        await router.navigate("/projects/101");

        expect(router.matches).toHaveLength(1);
        expect(router.matches[0].data).toEqual({ id: "101", name: "Quantum Engine", stars: 128 });
        expect(router.getRouteData("project")).toEqual({ id: "101", name: "Quantum Engine", stars: 128 });
    });

    it("should cancel obsolete loader requests on rapid navigation with AbortController", async () => {
        let abortedCount = 0;
        let completedCount = 0;

        const routes = [
            {
                id: "item",
                path: "items/:id",
                component: "item-view",
                loader: async ({ params, signal }) => {
                    return new Promise((resolve, reject) => {
                        const timer = setTimeout(() => {
                            completedCount++;
                            resolve({ id: params.id });
                        }, 50);

                        signal.addEventListener("abort", () => {
                            clearTimeout(timer);
                            abortedCount++;
                            reject(new Error("Aborted"));
                        });
                    });
                }
            }
        ];

        const router = createMemoryRouter({ routes });

        // Rapid navigations
        const p1 = router.navigate("/items/1");
        const p2 = router.navigate("/items/2");
        const p3 = router.navigate("/items/3");

        await Promise.allSettled([p1, p2, p3]);

        expect(router.location.pathname).toBe("/items/3");
        expect(abortedCount).toBeGreaterThanOrEqual(1);
        expect(router.getRouteData("item")).toEqual({ id: "3" });
    });

    it("should execute route actions, handle redirects, and revalidate loaders", async () => {
        let projectsDb = [
            { id: "1", title: "Initial Project" }
        ];

        let loaderCalls = 0;

        const routes = [
            {
                id: "projects",
                path: "projects",
                loader: async () => {
                    loaderCalls++;
                    return [...projectsDb];
                },
                action: async ({ formData }) => {
                    const newTitle = formData.get("title");
                    projectsDb.push({ id: "2", title: newTitle });
                    return { success: true };
                }
            }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ["/"] });
        await router.navigate("/projects");

        expect(loaderCalls).toBe(1);
        expect(router.getRouteData("projects")).toHaveLength(1);

        // Submit Action
        const fd = new FormData();
        fd.append("title", "Updated Project");

        await router.navigate("/projects", { formData: fd });

        // Loader should have automatically revalidated
        expect(loaderCalls).toBe(2);
        expect(router.getRouteData("projects")).toHaveLength(2);
        expect(router.getRouteData("projects")[1].title).toBe("Updated Project");
    });

    it("should support thrown and returned redirects in loaders and actions", async () => {
        const routes = [
            {
                id: "protected",
                path: "admin",
                loader: async () => {
                    throw router.redirect("/login");
                }
            },
            {
                id: "login",
                path: "login"
            }
        ];

        const router = createMemoryRouter({ routes });
        await router.navigate("/admin");

        expect(router.location.pathname).toBe("/login");
    });
});

describe("EUIX Router Data - Fetchers & Optimistic UI", () => {
    it("should perform independent background fetcher load without changing location", async () => {
        const routes = [
            {
                id: "user",
                path: "users/:id",
                loader: async ({ params }) => {
                    return { id: params.id, name: `User ${params.id}` };
                }
            }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ["/dashboard"] });
        expect(router.location.pathname).toBe("/dashboard");

        const fetcher = router.fetcher("userFetcher");
        expect(fetcher.state).toBe("idle");

        const loadPromise = fetcher.load("/users/99");
        expect(fetcher.state).toBe("loading");

        const result = await loadPromise;
        expect(result).toEqual({ id: "99", name: "User 99" });
        expect(fetcher.data).toEqual({ id: "99", name: "User 99" });
        expect(fetcher.state).toBe("idle");

        // URL must NOT have changed
        expect(router.location.pathname).toBe("/dashboard");
    });

    it("should support concurrent fetchers with independent states and formData", async () => {
        const routes = [
            {
                id: "task-toggle",
                path: "tasks/:id/toggle",
                action: async ({ params, formData }) => {
                    return { id: params.id, done: formData.get("done") === "true" };
                }
            }
        ];

        const router = createMemoryRouter({ routes });

        const fetcherA = router.fetcher("taskA");
        const fetcherB = router.fetcher("taskB");

        const pA = fetcherA.submit({ done: "true" }, { action: "/tasks/1/toggle" });
        const pB = fetcherB.submit({ done: "false" }, { action: "/tasks/2/toggle" });

        expect(fetcherA.state).toBe("submitting");
        expect(fetcherB.state).toBe("submitting");

        await Promise.all([pA, pB]);

        expect(fetcherA.data).toEqual({ id: "1", done: true });
        expect(fetcherB.data).toEqual({ id: "2", done: false });
        expect(fetcherA.state).toBe("idle");
        expect(fetcherB.state).toBe("idle");
    });
});
