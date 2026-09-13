// @vitest-environment node
/**
 * tests/router_server.test.js
 * Unit tests for SSR static router, hydration serialization, and client rehydration.
 */

import { describe, it, expect } from "vitest";
import {
    createStaticRouter,
    serializeHydrationState,
    getHydrationData,
    createMemoryRouter,
    EUIXRouter
} from "../src/plugins/router/index.js";

describe("EUIX Router Server - SSR & Hydration", () => {
    it("should execute server loaders and generate hydration state and script tag", async () => {
        const routes = [
            {
                id: "root",
                path: "/",
                loader: async () => ({ user: "Admin", role: "Superuser" }),
                children: [
                    {
                        id: "project",
                        path: "projects/:id",
                        loader: async ({ params }) => ({ id: params.id, title: `SSR Project ${params.id}` })
                    }
                ]
            }
        ];

        const serverResult = await createStaticRouter({
            url: "/projects/55",
            routes
        });

        expect(serverResult.location.pathname).toBe("/projects/55");
        expect(serverResult.matches).toHaveLength(2);
        expect(serverResult.loaderData.root).toEqual({ user: "Admin", role: "Superuser" });
        expect(serverResult.loaderData.project).toEqual({ id: "55", title: "SSR Project 55" });
        expect(serverResult.scriptTag).toContain('<script type="application/json" id="__EUIX_ROUTER_DATA__">');
        expect(serverResult.scriptTag).toContain("SSR Project 55");
    });

    it("should detect SSR redirects in static router", async () => {
        const routes = [
            {
                id: "auth",
                path: "private",
                redirect: "/login"
            }
        ];

        const serverResult = await createStaticRouter({
            url: "/private",
            routes
        });

        expect(serverResult.redirect).toBe("/login");
    });

    it("should escape unsafe script tags and characters during serialization", () => {
        const unsafeData = {
            malicious: '</script><script>alert("xss")</script>'
        };

        const serialized = serializeHydrationState(unsafeData);
        expect(serialized).not.toContain("</script><script>");
        expect(serialized).toContain("\\u003c");
    });

    it("should seed client router cache from hydration data without calling loaders again", async () => {
        let clientLoaderCalls = 0;

        const routes = [
            {
                id: "dashboard",
                path: "dashboard",
                loader: async () => {
                    clientLoaderCalls++;
                    return { stats: 100 };
                }
            }
        ];

        const hydrationData = {
            location: { pathname: "/dashboard", search: "", hash: "" },
            loaderData: {
                dashboard: { stats: 100 }
            }
        };

        const clientRouter = new EUIXRouter({
            routes,
            mode: "memory",
            hydrationData,
            initialEntries: ["/dashboard"]
        });

        await clientRouter.navigate("/dashboard");

        expect(clientLoaderCalls).toBe(0); // Kept from hydration cache!
        expect(clientRouter.getRouteData("dashboard")).toEqual({ stats: 100 });
    });
});
