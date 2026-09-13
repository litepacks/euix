/**
 * tests/router_core.test.js
 * Comprehensive unit tests for EUIX Router Core matching, ranking, history, and outlets.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    RouteMatcher,
    compileRouteBranches,
    matchPath,
    matchRoutes,
    generatePath,
    resolvePath,
    createPath,
    parsePath,
    createHistory,
    MemoryHistory,
    BrowserHistory,
    HashHistory,
    createLocation,
    createMemoryRouter,
    parseXmlRoutes
} from "../src/plugins/router/index.js";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXRouterPlugin } from "../src/plugins/EUIXRouterPlugin.js";

describe("EUIX Router Core - Utilities & Path Handling", () => {
    it("should parse and create paths accurately", () => {
        const parsed = parsePath("/projects/42?tab=settings&sort=asc#heading-1");
        expect(parsed.pathname).toBe("/projects/42");
        expect(parsed.search).toBe("?tab=settings&sort=asc");
        expect(parsed.hash).toBe("#heading-1");

        const recreated = createPath(parsed);
        expect(recreated).toBe("/projects/42?tab=settings&sort=asc#heading-1");
    });

    it("should resolve relative paths correctly", () => {
        expect(resolvePath("settings", "/projects/42")).toBe("/projects/42/settings");
        expect(resolvePath("./settings", "/projects/42")).toBe("/projects/42/settings");
        expect(resolvePath("../overview", "/projects/42/details")).toBe("/projects/42/overview");
        expect(resolvePath("../../dashboard", "/projects/42/details")).toBe("/projects/dashboard");
        expect(resolvePath("../../../dashboard", "/projects/42/details")).toBe("/dashboard");
        expect(resolvePath("/dashboard", "/projects/42")).toBe("/dashboard");
    });

    it("should interpolate generatePath accurately with dynamic, optional, and splats", () => {
        expect(generatePath("/projects/:id", { id: 42 })).toBe("/projects/42");
        expect(generatePath("/projects/:id/tasks/:taskId?", { id: 10, taskId: 99 })).toBe("/projects/10/tasks/99");
        expect(generatePath("/projects/:id/tasks/:taskId?", { id: 10 })).toBe("/projects/10/tasks");
        expect(generatePath("/files/*", { "*": "docs/readme.pdf" })).toBe("/files/docs/readme.pdf");
    });

    it("should throw on missing required param in generatePath", () => {
        expect(() => generatePath("/projects/:id", {})).toThrowError(/Missing required param "id"/);
    });
});

describe("EUIX Router Core - Route Ranking and Matching", () => {
    it("should prioritize static routes over dynamic and splat routes", () => {
        const routes = [
            { id: "splat", path: "*" },
            { id: "dynamic", path: "users/:userId" },
            { id: "static-new", path: "users/new" },
            { id: "static-admin", path: "users/admin" }
        ];

        const matcher = new RouteMatcher(routes);

        const matchNew = matcher.match("/users/new");
        expect(matchNew).not.toBeNull();
        expect(matchNew[matchNew.length - 1].id).toBe("static-new");

        const matchDynamic = matcher.match("/users/123");
        expect(matchDynamic).not.toBeNull();
        expect(matchDynamic[matchDynamic.length - 1].id).toBe("dynamic");
        expect(matchDynamic[matchDynamic.length - 1].params.userId).toBe("123");

        const match404 = matcher.match("/other/unknown/path");
        expect(match404).not.toBeNull();
        expect(match404[match404.length - 1].id).toBe("splat");
    });

    it("should match index and nested routes with inherited params", () => {
        const routes = [
            {
                id: "root",
                path: "/",
                layout: "AppLayout",
                children: [
                    { id: "home", index: true, component: "HomePage" },
                    {
                        id: "projects",
                        path: "projects",
                        layout: "ProjectsLayout",
                        children: [
                            { id: "projects-index", index: true, component: "ProjectsList" },
                            {
                                id: "project-detail",
                                path: ":projectId",
                                layout: "ProjectDetailLayout",
                                children: [
                                    { id: "project-settings", path: "settings", component: "ProjectSettings" }
                                ]
                            }
                        ]
                    }
                ]
            }
        ];

        const matcher = new RouteMatcher(routes);

        // Test root index
        const rootMatch = matcher.match("/");
        expect(rootMatch).toHaveLength(2);
        expect(rootMatch[0].id).toBe("root");
        expect(rootMatch[1].id).toBe("home");

        // Test nested index
        const projectsMatch = matcher.match("/projects");
        expect(projectsMatch).toHaveLength(3);
        expect(projectsMatch[0].id).toBe("root");
        expect(projectsMatch[1].id).toBe("projects");
        expect(projectsMatch[2].id).toBe("projects-index");

        // Test deeply nested route with inherited param
        const settingsMatch = matcher.match("/projects/42/settings");
        expect(settingsMatch).toHaveLength(4);
        expect(settingsMatch[0].id).toBe("root");
        expect(settingsMatch[1].id).toBe("projects");
        expect(settingsMatch[2].id).toBe("project-detail");
        expect(settingsMatch[3].id).toBe("project-settings");
        expect(settingsMatch[3].params.projectId).toBe("42");
    });
});

describe("EUIX Router Core - History Modes", () => {
    it("should navigate in MemoryHistory", () => {
        const history = new MemoryHistory({ initialEntries: ["/home"] });
        expect(history.location.pathname).toBe("/home");

        history.push("/dashboard");
        expect(history.location.pathname).toBe("/dashboard");

        history.push("/settings");
        expect(history.location.pathname).toBe("/settings");

        history.back();
        expect(history.location.pathname).toBe("/dashboard");

        history.forward();
        expect(history.location.pathname).toBe("/settings");

        history.replace("/overview");
        expect(history.location.pathname).toBe("/overview");
    });

    it("should support base path stripping and prefixing", () => {
        const history = new MemoryHistory({ base: "/app", initialEntries: ["/app/dashboard"] });
        expect(history.stripBase("/app/dashboard")).toBe("/dashboard");
        expect(history.prependBase("/projects")).toBe("/app/projects");
    });
});

describe("EUIX Router Core - XML Parser & Outlets with Layout Preservation", () => {
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

    it("should parse XML route trees into structured routes", () => {
        const xml = `
        <router mode="memory" base="/app">
            <route id="root" path="/" layout="./layouts/root.xml">
                <index component="./pages/home.xml" />
                <route id="projects" path="projects" component="./pages/projects.xml">
                    <route id="project" path=":id" component="./pages/project.xml" />
                </route>
                <route path="*" component="./pages/not-found.xml" />
            </route>
        </router>
        `;
        const doc = EUIXEngineCore.parseXmlToAst(xml);
        const routerNode = doc.querySelector("router");
        const parsedRoutes = parseXmlRoutes(routerNode);

        expect(parsedRoutes).toHaveLength(1);
        expect(parsedRoutes[0].id).toBe("root");
        expect(parsedRoutes[0].children).toHaveLength(3);
        expect(parsedRoutes[0].children[0].index).toBe(true);
        expect(parsedRoutes[0].children[1].id).toBe("projects");
        expect(parsedRoutes[0].children[1].children[0].id).toBe("project");
    });

    it("should mount engine with router, render outlets, and update links", async () => {
        const xml = `
        <uid_spec>
            <router mode="memory">
                <route id="root" path="/" layout="root-layout">
                    <index component="home-page" />
                    <route id="about" path="about" component="about-page" />
                </route>
            </router>

            <component_def name="root-layout">
                <div class="layout">
                    <nav>
                        <route-link to="/" exact="true" active-class="nav-active">Home</route-link>
                        <route-link to="/about" active-class="nav-active">About</route-link>
                    </nav>
                    <main>
                        <outlet />
                    </main>
                </div>
            </component_def>

            <component_def name="home-page">
                <h1>Home Page Content</h1>
            </component_def>

            <component_def name="about-page">
                <h1>About Page Content</h1>
            </component_def>

            <outlet />
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        expect(engine.router).toBeDefined();
        expect(engine.router.location.pathname).toBe("/");

        // Verify initial render
        expect(container.textContent).toContain("Home Page Content");
        const links = container.querySelectorAll("a");
        expect(links).toHaveLength(2);
        expect(links[0].classList.contains("nav-active")).toBe(true);

        // Navigate to /about
        await engine.router.navigate("/about");

        expect(container.textContent).toContain("About Page Content");
        expect(links[0].classList.contains("nav-active")).toBe(false);
        expect(links[1].classList.contains("nav-active")).toBe(true);
    });
});
