/**
 * tests/ast_cache.test.js
 * Comprehensive Test Suite for EUIX Engine Core XML Template AST Caching System
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXEngine } from "../src/EUIXEngine.js";

describe("EUIX Engine Core - XML Template AST Caching Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "app";
        document.body.appendChild(container);
        EUIXEngineCore.clearAstCache();
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        EUIXEngineCore.clearAstCache();
        EUIXEngineCore.setAstCacheSize(500);
    });

    it("should register a cache miss on first mount and a cache hit on identical template mount", () => {
        const xml = `<uid_spec><flex><h1>Test Title</h1></flex></uid_spec>`;

        expect(EUIXEngineCore.getAstCacheStats()).toEqual({
            size: 0,
            maxSize: 500,
            hits: 0,
            misses: 0,
            hitRatio: 0
        });

        // First mount -> Cache Miss
        const engine1 = EUIXEngineCore.mount(xml, container);
        const stats1 = EUIXEngineCore.getAstCacheStats();
        expect(stats1.misses).toBe(1);
        expect(stats1.hits).toBe(0);
        expect(stats1.size).toBe(1);
        expect(stats1.hitRatio).toBe(0);

        // Second mount with identical XML -> Cache Hit
        const container2 = document.createElement("div");
        const engine2 = EUIXEngineCore.mount(xml, container2);
        const stats2 = EUIXEngineCore.getAstCacheStats();
        expect(stats2.misses).toBe(1);
        expect(stats2.hits).toBe(1);
        expect(stats2.size).toBe(1);
        expect(stats2.hitRatio).toBe(0.5);
    });

    it("should guarantee DOM isolation: mutating a mounted DOM tree does NOT alter the cached AST template", () => {
        const xml = `<uid_spec><flex><span id="target">Original</span></flex></uid_spec>`;

        const engine1 = EUIXEngineCore.mount(xml, container);
        const span1 = container.querySelector("#target");
        expect(span1.textContent).toBe("Original");

        // Mutate mounted element
        span1.textContent = "Mutated In Engine 1";

        // Second mount retrieves cached AST template and mounts fresh clone
        const container2 = document.createElement("div");
        document.body.appendChild(container2);
        const engine2 = EUIXEngineCore.mount(xml, container2);
        const span2 = container2.querySelector("span");

        expect(span2.textContent).toBe("Original");

        if (container2.parentNode) container2.parentNode.removeChild(container2);
    });

    it("should enforce LRU cache size limits and evict least recently used templates", () => {
        EUIXEngineCore.setAstCacheSize(2);

        const t1 = `<uid_spec><div>Template 1</div></uid_spec>`;
        const t2 = `<uid_spec><div>Template 2</div></uid_spec>`;
        const t3 = `<uid_spec><div>Template 3</div></uid_spec>`;

        EUIXEngineCore.mount(t1, container);
        EUIXEngineCore.mount(t2, container);
        expect(EUIXEngineCore.getAstCacheStats().size).toBe(2);

        // Access t1 again to make t1 most recently used (t2 becomes least recently used)
        EUIXEngineCore.mount(t1, container);
        expect(EUIXEngineCore.getAstCacheStats().hits).toBe(1);

        // Mount t3 -> should evict t2 (the LRU entry)
        EUIXEngineCore.mount(t3, container);
        expect(EUIXEngineCore.getAstCacheStats().size).toBe(2);

        // Mounting t1 should hit
        EUIXEngineCore.mount(t1, container);
        expect(EUIXEngineCore.getAstCacheStats().hits).toBe(2);

        // Mounting t2 should miss (was evicted)
        EUIXEngineCore.mount(t2, container);
        expect(EUIXEngineCore.getAstCacheStats().hits).toBe(2);
        expect(EUIXEngineCore.getAstCacheStats().misses).toBe(4);
    });

    it("should support bypassCache: true to bypass AST caching", () => {
        const xml = `<uid_spec><p>Bypass Test</p></uid_spec>`;

        EUIXEngineCore.mount(xml, container, { bypassCache: true });
        let stats = EUIXEngineCore.getAstCacheStats();
        expect(stats.misses).toBe(1);
        expect(stats.hits).toBe(0);
        expect(stats.size).toBe(0); // Not saved in cache

        EUIXEngineCore.mount(xml, container, { bypassCache: true });
        stats = EUIXEngineCore.getAstCacheStats();
        expect(stats.misses).toBe(2);
        expect(stats.hits).toBe(0);
        expect(stats.size).toBe(0);
    });

    it("should clear cache stats and documents via clearAstCache()", () => {
        const xml = `<uid_spec><div>Clear Test</div></uid_spec>`;
        EUIXEngineCore.mount(xml, container);
        expect(EUIXEngineCore.getAstCacheStats().size).toBe(1);

        EUIXEngineCore.clearAstCache();
        const stats = EUIXEngineCore.getAstCacheStats();
        expect(stats.size).toBe(0);
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(0);
        expect(stats.hitRatio).toBe(0);
    });

    it("should accelerate 100 repeated mounts significantly using cached AST", () => {
        const complexXml = `
        <uid_spec>
            <data_model>
                <state id="count">0</state>
                <state id="user">Alice</state>
            </data_model>
            <flex direction="column" gap="12">
                <h1>Hello {data.user}</h1>
                <p>Counter: {data.count}</p>
                <button class="btn">+1</button>
            </flex>
        </uid_spec>
        `;

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            const temp = document.createElement("div");
            EUIXEngine.mount(complexXml, temp);
        }
        const duration = performance.now() - start;

        const stats = EUIXEngineCore.getAstCacheStats();
        expect(stats.hits).toBe(99);
        expect(stats.misses).toBe(1);
        expect(stats.hitRatio).toBe(0.99);
        expect(duration).toBeLessThan(4000);
    });
});
