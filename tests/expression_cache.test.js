import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXExpressionParser } from '../src/core/EUIXEngineCore.js';

describe('EUIXExpressionParser AST Cache & Telemetry Suite', () => {
    beforeEach(() => {
        EUIXExpressionParser.clearExpressionCache();
    });

    it('should register a cache miss on first evaluation and a cache hit on identical expression evaluation', () => {
        const expr = 'data.counter > 5 && data.is_active == true';
        const resolver = (name) => {
            if (name === 'data.counter') return 10;
            if (name === 'data.is_active') return true;
            return undefined;
        };

        // First evaluation -> Cache Miss
        const res1 = EUIXExpressionParser.eval(expr, resolver);
        expect(res1).toBe(true);

        let stats = EUIXExpressionParser.getExpressionCacheStats();
        expect(stats.misses).toBe(1);
        expect(stats.hits).toBe(0);

        // Second evaluation -> Cache Hit
        const res2 = EUIXExpressionParser.eval(expr, resolver);
        expect(res2).toBe(true);

        stats = EUIXExpressionParser.getExpressionCacheStats();
        expect(stats.misses).toBe(1);
        expect(stats.hits).toBe(1);
        expect(stats.hitRatio).toBe(0.5);
    });

    it('should handle 1,000 repeated expression evaluations with high cache hit ratio', () => {
        const expr = 'data.items.length * 2 + 10';
        const resolver = (name) => (name === 'data.items.length' ? 5 : undefined);

        for (let i = 0; i < 1000; i++) {
            const val = EUIXExpressionParser.eval(expr, resolver);
            expect(val).toBe(20);
        }

        const stats = EUIXExpressionParser.getExpressionCacheStats();
        expect(stats.misses).toBe(1);
        expect(stats.hits).toBe(999);
        expect(stats.hitRatio).toBeGreaterThan(0.99);
    });

    it('should clear expression cache stats via clearExpressionCache()', () => {
        EUIXExpressionParser.eval('data.x > 0', () => 1);
        expect(EUIXExpressionParser.getExpressionCacheStats().size).toBe(1);

        EUIXExpressionParser.clearExpressionCache();
        const stats = EUIXExpressionParser.getExpressionCacheStats();
        expect(stats.size).toBe(0);
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(0);
    });
});
