/**
 * tests/parser_cache_hardening.test.js
 * Comprehensive unit and regression tests for Item 5:
 * Expression Parser & AST Cache Hardening (AstParser.js / ExpressionParser.js).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import {
    _astCache,
    parseXmlToAst,
    clearAstCache,
    setAstCacheSize,
    getAstCacheStats,
    getSharedParser,
    resetSharedParser,
} from "../src/core/parser/AstParser.js";
import { EUIXExpressionParser } from "../src/core/parser/ExpressionParser.js";

describe("Item 5: Parser & AST Cache Hardening Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        EUIXEngineCore.clearAstCache();
        EUIXEngineCore.clearExpressionCache();
        EUIXEngineCore.setAstCacheSize(500);
        EUIXEngineCore.setExpressionCacheSize(2000);
        resetSharedParser();
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        EUIXEngineCore.clearAstCache();
        EUIXEngineCore.clearExpressionCache();
        EUIXEngineCore.setAstCacheSize(500);
        EUIXEngineCore.setExpressionCacheSize(2000);
        resetSharedParser();
    });

    describe("AstParser Shared DOMParser Singleton", () => {
        it("should return a shared DOMParser instance and reuse it", () => {
            const parser1 = getSharedParser();
            const parser2 = getSharedParser();
            expect(parser1).toBeDefined();
            expect(parser1).not.toBeNull();
            expect(parser1).toBe(parser2);

            expect(EUIXEngineCore.getSharedParser()).toBe(parser1);

            resetSharedParser();
            const parser3 = getSharedParser();
            expect(parser3).not.toBe(parser1);
        });

        it("should successfully parse XML using the shared parser singleton", () => {
            const xml = `<uid_spec><flex><span>Hello World</span></flex></uid_spec>`;
            const doc = parseXmlToAst(xml);
            expect(doc).toBeDefined();
            expect(doc.querySelector("span").textContent).toBe("Hello World");
        });
    });

    describe("AstParser Strict Bounded Cache Eviction", () => {
        it("should never exceed _astCacheMaxSize even when sanitizedXml !== xmlString (double-insert)", () => {
            // Set max size strictly to 3
            setAstCacheSize(3);

            // Create 10 templates that REQUIRE sanitization (e.g., void tags and raw ampersands)
            // In these templates, sanitizedXml !== xmlString
            for (let i = 0; i < 10; i++) {
                const xmlWithVoidAndAmp = `<uid_spec><input value="test_${i}"><span>A & B ${i}</span></uid_spec>`;
                parseXmlToAst(xmlWithVoidAndAmp);

                // At every single step, _astCache.size must NEVER exceed 3
                expect(_astCache.size).toBeLessThanOrEqual(3);
            }

            const stats = getAstCacheStats();
            expect(stats.size).toBeLessThanOrEqual(3);
            expect(stats.maxSize).toBe(3);
        });

        it("should maintain LRU eviction order with double-inserted keys", () => {
            // Each template with void tags / raw ampersands stores 2 keys (sanitizedXml & xmlString).
            // A capacity of 4 holds exactly 2 such templates.
            setAstCacheSize(4);

            const t1 = `<uid_spec><input value="1"><span>T1 & A</span></uid_spec>`;
            const t2 = `<uid_spec><input value="2"><span>T2 & B</span></uid_spec>`;
            const t3 = `<uid_spec><input value="3"><span>T3 & C</span></uid_spec>`;

            parseXmlToAst(t1);
            parseXmlToAst(t2);
            expect(_astCache.size).toBeLessThanOrEqual(4);

            // Re-access t1 so it becomes recently used
            parseXmlToAst(t1);

            // Parse t3 -> t2 should be evicted
            parseXmlToAst(t3);
            expect(_astCache.size).toBeLessThanOrEqual(4);

            // t1 should hit (was refreshed)
            const hitsBefore = getAstCacheStats().hits;
            parseXmlToAst(t1);
            expect(getAstCacheStats().hits).toBe(hitsBefore + 1);

            // t2 should miss (was evicted)
            const missesBefore = getAstCacheStats().misses;
            parseXmlToAst(t2);
            expect(getAstCacheStats().misses).toBe(missesBefore + 1);
        });

        it("should prune properly when setAstCacheSize is reduced dynamically", () => {
            for (let i = 0; i < 10; i++) {
                parseXmlToAst(`<uid_spec><div>Item ${i}</div></uid_spec>`);
            }
            expect(_astCache.size).toBe(10);

            // Dynamically shrink cache size to 4
            setAstCacheSize(4);
            expect(_astCache.size).toBe(4);
            expect(getAstCacheStats().maxSize).toBe(4);
        });
    });

    describe("ExpressionParser Hardening & Dynamic Cache Sizing", () => {
        it("should expose _cache getter referencing _compiledFnCache for backward compatibility", () => {
            expect(EUIXExpressionParser._cache).toBe(EUIXExpressionParser._compiledFnCache);
        });

        it("should support dynamic cache resizing via setExpressionCacheSize", () => {
            // Compile 10 expressions
            for (let i = 0; i < 10; i++) {
                EUIXExpressionParser.compileExpression(`data.value + ${i}`);
            }
            expect(EUIXExpressionParser.getExpressionCacheStats().size).toBe(10);

            // Resize down to 5
            EUIXExpressionParser.setExpressionCacheSize(5);
            expect(EUIXExpressionParser.getExpressionCacheStats().size).toBe(5);
            expect(EUIXExpressionParser.getExpressionCacheStats().maxSize).toBe(5);
        });

        it("should maintain strict bounds under continuous compilations when maxSize is small", () => {
            EUIXExpressionParser.setExpressionCacheSize(3);

            for (let i = 0; i < 20; i++) {
                EUIXExpressionParser.compileExpression(`data.x * ${i} + 1`);
                expect(EUIXExpressionParser._compiledFnCache.size).toBeLessThanOrEqual(3);
            }
            expect(EUIXExpressionParser.getExpressionCacheStats().size).toBe(3);
        });

        it("should maintain strict bounds for compileTemplateFunction as well", () => {
            EUIXExpressionParser.setExpressionCacheSize(3);

            for (let i = 0; i < 15; i++) {
                EUIXExpressionParser.compileTemplateFunction(`Hello {data.user_${i}}!`);
                expect(EUIXExpressionParser._compiledTemplateFnCache.size).toBeLessThanOrEqual(3);
            }
            expect(EUIXExpressionParser.getExpressionCacheStats().templateSize).toBe(3);
        });

        it("should provide true LRU eviction on repeated cache hits", () => {
            EUIXExpressionParser.setExpressionCacheSize(2);

            const e1 = "data.a + 1";
            const e2 = "data.b + 2";
            const e3 = "data.c + 3";

            EUIXExpressionParser.compileExpression(e1);
            EUIXExpressionParser.compileExpression(e2);
            expect(EUIXExpressionParser._compiledFnCache.size).toBe(2);

            // Re-access e1 -> moves e1 to most recently used, e2 is now LRU
            EUIXExpressionParser.compileExpression(e1);

            // Compile e3 -> should evict e2, keeping e1 and e3
            EUIXExpressionParser.compileExpression(e3);
            expect(EUIXExpressionParser._compiledFnCache.has(e1)).toBe(true);
            expect(EUIXExpressionParser._compiledFnCache.has(e3)).toBe(true);
            expect(EUIXExpressionParser._compiledFnCache.has(e2)).toBe(false);
        });
    });

    describe("EUIXEngineCore Cache Delegation API", () => {
        it("should delegate clearExpressionCache, getExpressionCacheStats, and setExpressionCacheSize", () => {
            EUIXEngineCore.compileExpression = (e) => EUIXExpressionParser.compileExpression(e);

            EUIXExpressionParser.compileExpression("data.count + 42");
            expect(EUIXEngineCore.getExpressionCacheStats().size).toBe(1);

            EUIXEngineCore.setExpressionCacheSize(50);
            expect(EUIXEngineCore.getExpressionCacheStats().maxSize).toBe(50);

            EUIXEngineCore.clearExpressionCache();
            expect(EUIXEngineCore.getExpressionCacheStats().size).toBe(0);
        });
    });
});
