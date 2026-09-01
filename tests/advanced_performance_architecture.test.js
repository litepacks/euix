import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { AstParser, serializeAst, deserializeAst } from "../src/core/parser/AstParser.js";

describe("Advanced Performance Architecture Test Suite (Başlık 2)", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    // -------------------------------------------------------------------------
    // 2.1 AST Serialization & Deserialization
    // -------------------------------------------------------------------------
    describe("2.1 AST Serialization & Pre-Compilation", () => {
        it("should serialize XML into lightweight JSON AST and deserialize back", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="title" type="string">EUIX Precompiled</state>
                        <state id="count" type="number">10</state>
                    </data_model>
                    <flex direction="column" class="p-4">
                        <h1 class="header">{data.title}</h1>
                        <p>Current count: {data.count}</p>
                    </flex>
                </uid_spec>
            `;

            const ast = AstParser.serializeAst(xml);
            expect(ast).not.toBeNull();
            expect(ast.type).toBe(9); // Document
            expect(ast.root.tag.toLowerCase()).toBe("uid_spec");

            // Direct mounting using pre-compiled AST object
            const engine = EUIXEngineCore.mount(ast, container);
            expect(engine.getState("title")).toBe("EUIX Precompiled");
            expect(engine.getState("count")).toBe(10);

            const h1 = container.querySelector(".header");
            expect(h1).not.toBeNull();
            expect(h1.textContent).toBe("EUIX Precompiled");
        });

        it("should expose serializeAst and deserializeAst as static methods on EUIXEngineCore", () => {
            expect(typeof EUIXEngineCore.serializeAst).toBe("function");
            expect(typeof EUIXEngineCore.deserializeAst).toBe("function");

            const xml = "<uid_spec><data_model><state id='x'>42</state></data_model></uid_spec>";
            const serialized = EUIXEngineCore.serializeAst(xml);
            expect(serialized).toBeDefined();

            const deserialized = EUIXEngineCore.deserializeAst(serialized);
            expect(deserialized).toBeDefined();
            expect(deserialized.nodeType).toBe(9);
        });
    });

    // -------------------------------------------------------------------------
    // 2.2 Concurrent Scheduler (startTransition, isPending, scheduleIdle)
    // -------------------------------------------------------------------------
    describe("2.2 Concurrent State Scheduler", () => {
        it("should manage isPending state during startTransition execution", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="heavy_data">initial</state>
                    </data_model>
                    <p id="target">{data.heavy_data}</p>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.isPending).toBe(false);

            let pendingDuringTransition = false;
            await engine.startTransition(() => {
                pendingDuringTransition = engine.isPending;
                engine.setState("heavy_data", "updated_async");
            });

            expect(pendingDuringTransition).toBe(true);
            expect(engine.isPending).toBe(false);
            expect(engine.getState("heavy_data")).toBe("updated_async");
        });

        it("should execute background tasks safely with scheduleIdle", async () => {
            const xml = `<uid_spec><data_model><state id="idleRan">false</state></data_model></uid_spec>`;
            const engine = EUIXEngineCore.mount(xml, container);

            const cancel = engine.scheduleIdle((eng) => {
                eng.setState("idleRan", "true");
            }, { timeout: 100 });

            expect(typeof cancel).toBe("function");

            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(engine.getState("idleRan")).toBe("true");
        });
    });
});
