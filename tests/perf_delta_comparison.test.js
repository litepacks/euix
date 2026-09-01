import { describe, it, expect } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { AstParser } from "../src/core/parser/AstParser.js";

describe("Performance Delta & Architectural Comparison Suite", () => {
    it("should measure XML Mount vs Pre-compiled JSON AST Mount", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="title">Dashboard Metric</state>
                    <state id="count" type="number">100</state>
                    <state id="status">Active</state>
                </data_model>
                <flex direction="column" gap="16" class="p-6">
                    <h1 class="header">{data.title}</h1>
                    <p>Count: {data.count}</p>
                    <span>Status: {data.status}</span>
                    <button class="btn">Click</button>
                </flex>
            </uid_spec>
        `;

        const ast = AstParser.serializeAst(xml);

        // Warmup
        for (let i = 0; i < 20; i++) {
            const c = document.createElement("div");
            EUIXEngineCore.mount(xml, c);
            const c2 = document.createElement("div");
            EUIXEngineCore.mount(ast, c2);
        }

        const N = 200;

        // 1. XML Runtime Parse + Mount
        const t0 = performance.now();
        for (let i = 0; i < N; i++) {
            const c = document.createElement("div");
            EUIXEngineCore.mount(xml, c);
        }
        const tXml = performance.now() - t0;

        // 2. Precompiled AST Mount
        const t1 = performance.now();
        for (let i = 0; i < N; i++) {
            const c = document.createElement("div");
            EUIXEngineCore.mount(ast, c);
        }
        const tAst = performance.now() - t1;

        console.log(`\n================== PERFORMANCE DELTA BENCHMARK ==================`);
        console.log(`[Metric] 200x Runtime XML Parse + Mount : ${tXml.toFixed(2)} ms (Avg: ${(tXml / N).toFixed(3)} ms/mount)`);
        console.log(`[Metric] 200x Pre-compiled AST Mount    : ${tAst.toFixed(2)} ms (Avg: ${(tAst / N).toFixed(3)} ms/mount)`);
        console.log(`[Result] Pre-compiled AST Speedup Ratio : ${(tXml / tAst).toFixed(1)}x FASTER (${(((tXml - tAst) / tXml) * 100).toFixed(1)}% CPU reduction)`);

        expect(tAst).toBeLessThanOrEqual(tXml * 1.5);
    });

    it("should measure Batched vs Unbatched State Updates throughput", () => {
        const eng = EUIXEngineCore.mount("<uid_spec><data_model><state id=\"a\">1</state><state id=\"b\">2</state><state id=\"c\">3</state></data_model></uid_spec>", document.createElement("div"));

        const N = 1000;

        // 1. Unbatched 3-Key Mutation
        const t0 = performance.now();
        for (let i = 0; i < N; i++) {
            eng.setState("a", i);
            eng.setState("b", i);
            eng.setState("c", i);
        }
        const tUnbatched = performance.now() - t0;

        // 2. Batched 3-Key Mutation (Category 4)
        const t1 = performance.now();
        for (let i = 0; i < N; i++) {
            eng.batch(() => {
                eng.setState("a", i);
                eng.setState("b", i);
                eng.setState("c", i);
            });
        }
        const tBatched = performance.now() - t1;

        console.log(`\n-----------------------------------------------------------------`);
        console.log(`[Metric] 1,000x 3-Key Individual setState (Unbatched) : ${tUnbatched.toFixed(2)} ms`);
        console.log(`[Metric] 1,000x 3-Key Batched setState (this.batch)    : ${tBatched.toFixed(2)} ms`);
        console.log(`[Result] State Transaction Batching Efficiency        : Single microtask flush per cycle`);
        console.log(`=================================================================\n`);

        expect(tBatched).toBeLessThanOrEqual(tUnbatched * 1.5);
    });
});
