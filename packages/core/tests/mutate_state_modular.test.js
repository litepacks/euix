import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import {
    parseMutateExpr,
    evaluateObjectExpression,
    _handleMutateStateAction,
} from "../src/core/actions/MutateStateAction.js";

describe("MutateStateAction Modular Unit Tests", () => {
    describe("parseMutateExpr", () => {
        it("should parse simple method calls", () => {
            const res = parseMutateExpr("items.CLEAR");
            expect(res).toEqual({
                path: "items",
                operation: "CLEAR",
                value: "",
                where: null,
            });
        });

        it("should parse method calls with arguments", () => {
            const res = parseMutateExpr("todos.PUSH({ id: 1, title: 'Test' })");
            expect(res.path).toBe("todos");
            expect(res.operation).toBe("PUSH");
            expect(res.value).toBe("{ id: 1, title: 'Test' }");
        });

        it("should parse where clauses", () => {
            const res = parseMutateExpr("users.REMOVE where id == 42");
            expect(res.path).toBe("users");
            expect(res.operation).toBe("REMOVE");
            expect(res.where).toEqual({
                field: "id",
                op: "eq",
                equals: "42",
            });
        });

        it("should return null for invalid expressions", () => {
            expect(parseMutateExpr("")).toBeNull();
            expect(parseMutateExpr(null)).toBeNull();
            expect(parseMutateExpr("invalid_format")).toBeNull();
        });
    });

    describe("evaluateObjectExpression", () => {
        it("should parse raw JSON objects", () => {
            const engine = new EUIXEngineCore();
            const res = evaluateObjectExpression(engine, '{"a": 1, "b": "hello"}');
            expect(res).toEqual({ a: 1, b: "hello" });
        });

        it("should return null for empty or non-string expressions", () => {
            const engine = new EUIXEngineCore();
            expect(evaluateObjectExpression(engine, "")).toBeNull();
            expect(evaluateObjectExpression(engine, null)).toBeNull();
        });
    });

    describe("_handleMutateStateAction execution with EUIXEngineCore", () => {
        let engine;

        beforeEach(() => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="items" type="array">[{"id":1,"name":"A"},{"id":2,"name":"B"},{"id":3,"name":"C"}]</state>
                        <state id="count" type="number">10</state>
                    </data_model>
                    <container></container>
                </uid_spec>
            `;
            const container = document.createElement("div");
            engine = EUIXEngineCore.mount(xml, container);
        });

        it("should handle CLEAR operation", () => {
            const actionNode = document.createElement("on_click");
            actionNode.setAttribute("mutate", "items.CLEAR");
            _handleMutateStateAction.call(engine, actionNode, {});
            expect(engine.getState("items")).toEqual([]);
        });

        it("should handle PUSH operation via shorthand", () => {
            const actionNode = document.createElement("on_click");
            actionNode.setAttribute("mutate", "items.PUSH({id: 4, name: 'D'})");
            _handleMutateStateAction.call(engine, actionNode, {});
            const items = engine.getState("items");
            expect(items.length).toBe(4);
            expect(items[3].name).toBe("D");
        });

        it("should handle POP and SHIFT operations", () => {
            const popNode = document.createElement("on_click");
            popNode.setAttribute("path", "items");
            popNode.setAttribute("op", "POP");
            _handleMutateStateAction.call(engine, popNode, {});
            expect(engine.getState("items").length).toBe(2);

            const shiftNode = document.createElement("on_click");
            shiftNode.setAttribute("path", "items");
            shiftNode.setAttribute("op", "SHIFT");
            _handleMutateStateAction.call(engine, shiftNode, {});
            expect(engine.getState("items").length).toBe(1);
            expect(engine.getState("items")[0].name).toBe("B");
        });

        it("should handle REVERSE and SORT operations", () => {
            const revNode = document.createElement("on_click");
            revNode.setAttribute("path", "items");
            revNode.setAttribute("op", "REVERSE");
            _handleMutateStateAction.call(engine, revNode, {});
            expect(engine.getState("items")[0].name).toBe("C");

            const sortNode = document.createElement("on_click");
            sortNode.setAttribute("path", "items");
            sortNode.setAttribute("op", "SORT");
            sortNode.setAttribute("by", "name");
            sortNode.setAttribute("order", "asc");
            _handleMutateStateAction.call(engine, sortNode, {});
            expect(engine.getState("items")[0].name).toBe("A");
        });

        it("should handle INCREMENT and DECREMENT operations", () => {
            const incNode = document.createElement("on_click");
            incNode.setAttribute("path", "count");
            incNode.setAttribute("op", "INCREMENT");
            _handleMutateStateAction.call(engine, incNode, {});
            expect(engine.getState("count")).toBe(11);

            const decNode = document.createElement("on_click");
            decNode.setAttribute("path", "count");
            decNode.setAttribute("op", "DECREMENT");
            _handleMutateStateAction.call(engine, decNode, {});
            expect(engine.getState("count")).toBe(10);
        });

        it("should execute RUN_SCRIPT and leverage compiled script cache", () => {
            const scriptNode = document.createElement("on_click");
            scriptNode.setAttribute("action", "RUN_SCRIPT");
            scriptNode.setAttribute("code", "$data.count += 5;");
            engine._handleActionInternal(scriptNode, {});
            expect(engine.getState("count")).toBe(15);

            // Execute again - should hit the script compilation cache cleanly
            engine._handleActionInternal(scriptNode, {});
            expect(engine.getState("count")).toBe(20);

            // Clear cache
            expect(() => EUIXEngineCore.clearActionCaches()).not.toThrow();

            // Execute once more after cache clearing
            engine._handleActionInternal(scriptNode, {});
            expect(engine.getState("count")).toBe(25);
        });
    });
});
