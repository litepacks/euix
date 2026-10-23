import { describe, it, expect } from "vitest";
import {
    safeStringify,
    safeParse,
    toNum,
    toInt,
    getTagName,
    getAttr,
    queryAll,
    isScoped,
    trimStr,
    splitPath,
    getRootKey,
    isPlainObj,
    getForEachItemHash,
} from "../src/core/utils/constants.js";
import { getChild, getChildren } from "../src/core/utils/domHelpers.js";

describe("Core Utils Resilience & Edge Cases", () => {
    describe("safeStringify", () => {
        it("handles undefined, null, primitives", () => {
            expect(safeStringify(undefined)).toBe("");
            expect(safeStringify(null)).toBe("null");
            expect(safeStringify("hello")).toBe("hello");
            expect(safeStringify(42)).toBe("42");
            expect(safeStringify(true)).toBe("true");
            expect(safeStringify(false)).toBe("false");
        });

        it("safely handles BigInt without throwing", () => {
            const big = BigInt(9007199254740991);
            expect(safeStringify(big)).toBe("9007199254740991");

            const objWithBig = { count: BigInt(123), title: "Test" };
            const json = safeStringify(objWithBig);
            expect(json).toContain('"count":"123"');
            expect(json).toContain('"title":"Test"');
        });

        it("safely handles Symbols without throwing", () => {
            const sym = Symbol("test");
            expect(safeStringify(sym)).toBe("Symbol(test)");

            const objWithSym = { sym };
            expect(() => safeStringify(objWithSym)).not.toThrow();
        });

        it("safely handles circular references", () => {
            const circular = { name: "Root" };
            circular.self = circular;
            const res = safeStringify(circular);
            expect(res).toContain('"name":"Root"');
            expect(res).toContain('"self":"[Circular]"');
        });

        it("safely serializes DOM nodes and circular structures", () => {
            const mockDom = { nodeType: 1, tagName: "DIV" };
            mockDom.owner = mockDom; // circular like real DOM node
            const fn = () => {};
            const obj = { el: mockDom, action: fn, count: 10 };
            const res = safeStringify(obj);
            expect(res).toContain('"el":"[DOM Node]"');
            expect(res).toContain('"count":10');
        });
    });

    describe("safeParse", () => {
        it("parses valid JSON strings", () => {
            expect(safeParse('{"x":1}')).toEqual({ x: 1 });
            expect(safeParse("[1, 2, 3]")).toEqual([1, 2, 3]);
        });

        it("returns fallback for invalid JSON strings or empty/null", () => {
            expect(safeParse("{bad json}", { fallback: true })).toEqual({ fallback: true });
            expect(safeParse("", "default")).toBe("default");
            expect(safeParse(null, 42)).toBe(42);
            expect(safeParse(undefined, "fb")).toBe("fb");
        });

        it("returns already-parsed objects as-is", () => {
            const obj = { already: "parsed" };
            expect(safeParse(obj)).toBe(obj);
        });
    });

    describe("toNum & toInt empty and null semantics", () => {
        it("returns defaultVal for empty strings, whitespace, and null", () => {
            expect(toNum("", 100)).toBe(100);
            expect(toNum("   ", 50)).toBe(50);
            expect(toNum(null, 25)).toBe(25);
            expect(toNum(undefined, 75)).toBe(75);
            expect(toNum(Symbol("x"), 10)).toBe(10);
            expect(toNum("invalid", 42)).toBe(42);
            expect(toNum("123.45", 0)).toBe(123.45);
            expect(toNum(0, 10)).toBe(0);
        });

        it("toInt returns defaultVal for empty strings, whitespace, and null", () => {
            expect(toInt("", 100)).toBe(100);
            expect(toInt("   ", 50)).toBe(50);
            expect(toInt(null, 25)).toBe(25);
            expect(toInt(undefined, 75)).toBe(75);
            expect(toInt(Symbol("x"), 10)).toBe(10);
            expect(toInt("invalid", 42)).toBe(42);
            expect(toInt("123px", 0)).toBe(123);
            expect(toInt(0, 10)).toBe(0);
        });
    });

    describe("DOM Clobbering Defense (getTagName, getAttr, getChild, getChildren)", () => {
        it("getTagName survives form input with name=tagName", () => {
            // Simulated clobbered form element
            const clobberedForm = {
                tagName: { nodeType: 1, name: "tagName", value: "malicious" },
                nodeName: "FORM",
            };
            expect(getTagName(clobberedForm)).toBe("form");

            const standardEl = { tagName: "BUTTON" };
            expect(getTagName(standardEl)).toBe("button");

            expect(getTagName(null)).toBe("");
            expect(getTagName(undefined)).toBe("");
            expect(getTagName({})).toBe("");
        });

        it("getAttr survives form input with name=getAttribute", () => {
            const clobberedForm = {
                getAttribute: { nodeType: 1, name: "getAttribute" },
            };
            expect(getAttr(clobberedForm, "data-action")).toBe("");

            const validEl = {
                getAttribute: (name) => (name === "id" ? "my-id" : null),
            };
            expect(getAttr(validEl, "class", "id")).toBe("my-id");
            expect(getAttr(null, "id")).toBe("");
        });

        it("getChild and getChildren survive clobbered child tagName", () => {
            const clobberedChild = {
                nodeType: 1,
                tagName: { name: "tagName" }, // clobbered
                nodeName: "INPUT",
            };
            const normalChild = {
                nodeType: 1,
                tagName: "SPAN",
            };
            const parent = {
                children: [clobberedChild, normalChild],
            };

            expect(getChild(parent, "input")).toBe(clobberedChild);
            expect(getChild(parent, "span")).toBe(normalChild);
            expect(getChildren(parent, "input")).toEqual([clobberedChild]);
            expect(getChildren(parent)).toHaveLength(2);
        });
    });

    describe("queryAll malformed selector resilience", () => {
        it("returns EMPTY_ARR instead of throwing on invalid selector", () => {
            const mockEl = {
                querySelectorAll: () => {
                    throw new Error("SyntaxError: '::invalid' is not a valid selector");
                },
            };
            expect(queryAll(mockEl, "::invalid")).toEqual([]);
            expect(queryAll(null, "div")).toEqual([]);
        });
    });

    describe("isScoped resilience", () => {
        it("handles standard scope attributes and clobbering", () => {
            const scopedEl = {
                getAttribute: (k) => (k === "scope" ? "local" : null),
            };
            expect(isScoped(scopedEl)).toBe(true);

            const isolatedEl = {
                getAttribute: (k) => (k === "isolated" ? "true" : null),
            };
            expect(isScoped(isolatedEl)).toBe(true);

            const clobberedEl = {
                getAttribute: { name: "getAttribute" },
            };
            expect(isScoped(clobberedEl)).toBe(false);
            expect(isScoped(null)).toBe(false);
        });
    });

    describe("trimStr edge cases", () => {
        it("handles numbers, booleans, and null/undefined without throwing", () => {
            expect(trimStr("  test  ")).toBe("test");
            expect(trimStr(0)).toBe("0");
            expect(trimStr(42)).toBe("42");
            expect(trimStr(true)).toBe("true");
            expect(trimStr(false)).toBe("false");
            expect(trimStr(null)).toBe("");
            expect(trimStr(undefined)).toBe("");
            expect(trimStr({ textContent: "  node text  " })).toBe("node text");
        });
    });

    describe("splitPath & getRootKey", () => {
        it("handles strings, bracket notation, and arrays", () => {
            expect(splitPath("user.profile.name")).toEqual(["user", "profile", "name"]);
            expect(splitPath("items[0].title")).toEqual(["items", "0", "title"]);
            expect(splitPath(["users", 0, "name"])).toEqual(["users", "0", "name"]);
            expect(splitPath("")).toEqual([]);
            expect(splitPath(null)).toEqual([]);

            expect(getRootKey("user.profile.name")).toBe("user");
            expect(getRootKey("items[0]")).toBe("items");
            expect(getRootKey(["cart", "total"])).toBe("cart");
            expect(getRootKey("")).toBe("");
        });
    });

    describe("isPlainObj", () => {
        it("accurately identifies plain objects", () => {
            expect(isPlainObj({})).toBe(true);
            expect(isPlainObj({ a: 1 })).toBe(true);
            expect(isPlainObj([])).toBe(false);
            expect(isPlainObj(null)).toBe(false);
            expect(isPlainObj(undefined)).toBe(false);
            expect(isPlainObj("str")).toBe(false);
            expect(isPlainObj(42)).toBe(false);
            expect(isPlainObj(new Date())).toBe(false);
            expect(isPlainObj(new Map())).toBe(false);
        });
    });

    describe("getForEachItemHash symbol safety", () => {
        it("hashes objects with symbols and nested objects safely", () => {
            const sym = Symbol("id");
            const item = { id: 1, name: "Item", symToken: sym, nested: { id: "child_1" } };
            const hash = getForEachItemHash(item);
            expect(typeof hash).toBe("string");
            expect(hash).toContain("id:1");
            expect(hash).toContain("symToken:Symbol(id)");
            expect(hash).toContain("nested:child_1");
        });
    });
});
