import { describe, it, expect } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXExpressionParser } from "../src/core/parser/ExpressionParser.js";
import { compileXmlToAst } from "../src/compiler/index.js";
import { EUIXComposerPlugin, EUIXActionRegistry } from "../src/plugins/EUIXComposerPlugin.js";

describe("Category 1 Critical Fixes Test Suite", () => {
    describe("1. ExpressionParser Equality & Relational Operator Refinement", () => {
        it("should accurately compare date strings and lexicographical strings", () => {
            const getter = (k) => {
                if (k === "d1") return "2026-09-01";
                if (k === "d2") return "2026-08-31";
                if (k === "alpha1") return "zebra";
                if (k === "alpha2") return "apple";
                return undefined;
            };

            expect(EUIXExpressionParser.eval("d1 > d2", getter)).toBe(true);
            expect(EUIXExpressionParser.eval("d2 < d1", getter)).toBe(true);
            expect(EUIXExpressionParser.eval("d1 >= d2", getter)).toBe(true);
            expect(EUIXExpressionParser.eval("d2 <= d1", getter)).toBe(true);
            expect(EUIXExpressionParser.eval("alpha1 > alpha2", getter)).toBe(true);
            expect(EUIXExpressionParser.eval("alpha2 < alpha1", getter)).toBe(true);
        });

        it("should correctly compare numbers with relational operators", () => {
            const getter = (k) => (k === "count" ? 42 : 10);
            expect(EUIXExpressionParser.eval("count > 10", getter)).toBe(true);
            expect(EUIXExpressionParser.eval("count <= 42", getter)).toBe(true);
            expect(EUIXExpressionParser.eval("count < 5", getter)).toBe(false);
        });

        it("should prevent false positives in equality comparison (null, empty string, objects)", () => {
            const obj1 = { id: 1 };
            const obj2 = { id: 2 };
            const getter = (k) => {
                if (k === "nullVal") return null;
                if (k === "emptyStr") return "";
                if (k === "zeroVal") return 0;
                if (k === "zeroStr") return "0";
                if (k === "obj1") return obj1;
                if (k === "obj2") return obj2;
                return undefined;
            };

            // null vs "" must NOT be equal
            expect(EUIXExpressionParser.eval("nullVal == emptyStr", getter)).toBe(false);
            expect(EUIXExpressionParser.eval("nullVal != emptyStr", getter)).toBe(true);

            // 0 vs "" must NOT be equal
            expect(EUIXExpressionParser.eval("zeroVal == emptyStr", getter)).toBe(false);

            // 0 vs "0" should be equal under template evaluation
            expect(EUIXExpressionParser.eval("zeroVal == zeroStr", getter)).toBe(true);

            // Two distinct objects should NOT be equal
            expect(EUIXExpressionParser.eval("obj1 == obj2", getter)).toBe(false);
            expect(EUIXExpressionParser.eval("obj1 != obj2", getter)).toBe(true);

            // Same object reference is equal
            expect(EUIXExpressionParser.eval("obj1 == obj1", getter)).toBe(true);
        });
    });

    describe("2. Standalone Compiler compileXmlToAst with > in Attribute Values", () => {
        it("should correctly parse tags with '>' inside attribute values", () => {
            const xml = `<if condition="data.count > 5"><button label="Next >">Submit</button></if>`;
            const ast = compileXmlToAst(xml);

            expect(ast).toBeTruthy();
            expect(ast.tag).toBe("if");
            expect(ast.attrs.condition).toBe("data.count > 5");
            expect(ast.children.length).toBe(1);
            expect(ast.children[0].tag).toBe("button");
            expect(ast.children[0].attrs.label).toBe("Next >");
            expect(ast.children[0].children[0]).toBe("Submit");
        });

        it("should parse multiple comparison operators within attribute quotes", () => {
            const xml = `<container><div title="a > b && c < d">Content</div></container>`;
            const ast = compileXmlToAst(xml);

            expect(ast.tag).toBe("container");
            expect(ast.children[0].attrs.title).toBe("a > b && c < d");
        });
    });

    describe("3. EUIXComposerPlugin direct-child parameter filtering", () => {
        it("should only collect direct child <param> nodes and not pollute from nested sub-steps", () => {
            const xmlStr = `
                <action_def name="ComplexAction">
                    <param name="topLevelParam" required="true" default="root" />
                    <step action="CUSTOM_SUB_ACTION">
                        <param name="nestedShouldBeIgnored" value="nested" />
                    </step>
                    <return>{args.topLevelParam}</return>
                </action_def>
            `;

            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlStr, "text/xml");
            const actionNode = doc.documentElement;

            const def = EUIXActionRegistry.parseXmlActionDef("ComplexAction", actionNode);
            expect(def.params.length).toBe(1);
            expect(def.params[0].name).toBe("topLevelParam");
            expect(def.steps.length).toBe(1);
        });
    });
});
