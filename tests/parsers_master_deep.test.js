import { describe, it, expect } from 'vitest';
import { EUIXExpressionParser } from '../src/core/parser/ExpressionParser.js';
import { parseXmlToAst, generateCodeFrame, getAstCacheStats } from '../src/core/parser/AstParser.js';

describe('Expression & AST Parser Deep Suite', () => {
    it('should tokenize and evaluate complex expressions (nested parens, arithmetic, comparisons, ternary)', () => {
        const getter = (key) => {
            const data = {
                a: 10,
                b: 20,
                active: true,
                status: 'ok'
            };
            return data[key] ?? 0;
        };

        // 1. Math and parens
        expect(EUIXExpressionParser.eval('(a + b) * 2 - 10', getter)).toBe(50);
        expect(EUIXExpressionParser.eval('b % 3', getter)).toBe(2);

        // 2. Comparisons and logical operators
        expect(EUIXExpressionParser.eval('a < b && b == 20', getter)).toBe(true);
        expect(EUIXExpressionParser.eval('a >= 10 || b < 5', getter)).toBe(true);
        expect(EUIXExpressionParser.eval('!active', getter)).toBe(false);

        // 3. Nested ternary
        expect(EUIXExpressionParser.eval('a > 15 ? 1 : b > 15 ? 2 : 3', getter)).toBe(2);

        // 4. String literals with escaped characters
        expect(EUIXExpressionParser.eval('"hello \\"world\\""', getter)).toBe('hello "world"');
    });

    it('should compile expressions and templates to high-speed functions (compileExpression)', () => {
        const fn = EUIXExpressionParser.compileExpression('count + 5');
        expect(fn).toBeTypeOf('function');
        expect(fn((key) => key === 'count' ? 10 : 0)).toBe(15);

        const templateFn = EUIXExpressionParser.compileTemplateFunction('Count: {data.count}');
        expect(templateFn).toBeTypeOf('function');
    });

    it('should test parseXmlToAst caching, XML parsing, and code frame generation', () => {
        const validXml = `<uid_spec><flex gap="8"><span>Item</span></flex></uid_spec>`;
        const ast1 = parseXmlToAst(validXml);
        expect(ast1).toBeTruthy();

        // Cache hit
        const ast2 = parseXmlToAst(validXml);
        expect(ast2).toBeTruthy();

        // Code frame generator
        const frame = generateCodeFrame('<root>\n  <bad_tag>\n</root>', 2, 3);
        expect(frame).toContain('bad_tag');

        // Stats
        const stats = getAstCacheStats();
        expect(stats.hits).toBeGreaterThan(0);
    });
});
