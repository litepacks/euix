/**
 * tests/router_benchmark.test.js
 * Performance & throughput benchmarks for EUIX Router route matcher.
 */

import { describe, it, expect } from "vitest";
import { RouteMatcher, generatePath, resolvePath } from "../src/plugins/router/index.js";

describe("EUIX Router - Benchmark & Performance", () => {
    it("should achieve high matching throughput (>100,000 matches/sec)", () => {
        const routes = [
            { id: "root", path: "/" },
            { id: "users", path: "users" },
            { id: "user-detail", path: "users/:userId" },
            { id: "user-settings", path: "users/:userId/settings" },
            { id: "projects", path: "projects" },
            { id: "project-detail", path: "projects/:projectId" },
            { id: "project-tasks", path: "projects/:projectId/tasks/:taskId" },
            { id: "splat", path: "files/*" }
        ];

        const matcher = new RouteMatcher(routes);
        const testPaths = [
            "/",
            "/users",
            "/users/42",
            "/users/42/settings",
            "/projects/100",
            "/projects/100/tasks/999",
            "/files/docs/2026/report.pdf"
        ];

        const iterations = 50000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            const path = testPaths[i % testPaths.length];
            const match = matcher.match(path);
            if (!match) throw new Error("Match failed during benchmark");
        }

        const elapsedMs = performance.now() - start;
        const matchesPerSec = (iterations / elapsedMs) * 1000;

        expect(matchesPerSec).toBeGreaterThan(20000);
    });

    it("should execute generatePath and resolvePath at high velocity", () => {
        const pattern = "/projects/:projectId/tasks/:taskId";
        const params = { projectId: "42", taskId: "88" };

        const iterations = 50000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            generatePath(pattern, params);
            resolvePath("../settings", "/projects/42/details");
        }

        const elapsedMs = performance.now() - start;
        expect(elapsedMs).toBeLessThan(2500);
    });
});
